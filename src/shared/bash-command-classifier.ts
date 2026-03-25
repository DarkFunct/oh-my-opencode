/**
 * Bash Command Intent Classifier
 *
 * Classifies bash commands as read-only vs write to enable
 * intent-aware governance. Read-only commands (git status, ls, ping)
 * should not count against execution ratios or trigger pre-flight guards.
 *
 * Design: conservative — unknown commands default to "not read-only".
 * Only explicitly recognized safe patterns are whitelisted.
 */

/**
 * Patterns that indicate the command modifies files/state.
 * Checked FIRST — any match → immediately "not read-only".
 */
const WRITE_INDICATORS: RegExp[] = [
	// Git write operations
	/\bgit\s+(add|commit|push|pull|merge|rebase|checkout|switch|reset|clean|cherry-pick|am|format-patch|stash\s+(push|pop|drop|apply|clear))\b/,
	// File system modifications
	/\b(rm|rmdir|mv|cp|mkdir|chmod|chown|chgrp|touch|ln|install|mkfifo|mknod|truncate|shred)\s/,
	// In-place edits
	/\bsed\s+-i\b/,
	// Package manager installs
	/\b(npm|npx|bun|pip|pip3|cargo|go)\s+(install|uninstall|remove|add|update|upgrade)\b/,
	// Output redirection that writes files (but not | pipes)
	/\s+>{1,2}\s*\S/,
	// Destructive docker operations
	/\bdocker\s+(rm|rmi|stop|kill|prune|build|run|create|exec)\b/,
	// Service management (writes)
	/\b(systemctl|service)\s+(start|stop|restart|enable|disable|reload)\b/,
]

/**
 * Patterns that indicate a clearly read-only or diagnostic command.
 * Checked ONLY after WRITE_INDICATORS find no match.
 */
const READ_ONLY_PATTERNS: RegExp[] = [
	// VCS read-only queries
	/\bgit\s+(status|diff|log|show|branch|tag|remote|rev-parse|describe|shortlog|reflog|stash\s+list|ls-files|ls-tree|config\s+(--get|--list|list)|blame|name-rev|for-each-ref|count-objects)\b/,
	// File system inspection
	/\b(ls|cat|head|tail|wc|file|stat|du|df|find|which|where|readlink|realpath|tree|less|more|strings|od|hexdump|md5sum|sha256sum|shasum)\b/,
	// System info
	/\b(echo|printf|env|printenv|whoami|hostname|uname|arch|date|uptime|id|groups|locale|timedatectl|sw_vers)\b/,
	// Process info
	/\b(ps|pgrep|top|htop|lsof|free|vmstat|iostat|mpstat|nproc|sysctl)\b/,
	// Network diagnostics
	/\b(ping|traceroute|tracepath|nslookup|dig|host|ifconfig|ip\s+(addr|link|route|neigh)|netstat|ss|curl|wget|nc|nmap)\b/,
	// SSH / remote connectivity (connecting is not a local write)
	/\b(ssh|scp|rsync|sftp|telnet|ftp)\b/,
	// Docker read-only
	/\bdocker\s+(ps|logs|inspect|images|stats|top|port|version|info|network\s+(ls|inspect)|volume\s+(ls|inspect))\b/,
	// Container orchestration read-only
	/\b(docker-compose|docker\s+compose)\s+(ps|logs|config|top|images|version)\b/,
	/\bkubectl\s+(get|describe|logs|top|cluster-info|config\s+(view|current-context)|version|api-resources)\b/,
	// Tmux read-only
	/\btmux\s+(ls|list-sessions|list-windows|list-panes|show-options|display-message|has-session)\b/,
	// Service status (read-only)
	/\b(systemctl|service)\s+(status|is-active|is-enabled|list-units|list-unit-files|show)\b/,
	// Version/info queries
	/\b(node|bun|npm|npx|pip|pip3|python|python3|go|cargo|ruby|java|javac|rustc|gcc|g\+\+|clang|make|cmake)\s+(-v|--version|version)\b/,
	// Package info queries (no install)
	/\bnpm\s+(list|ls|info|view|outdated|audit|why|explain|pack\s+--dry-run)\b/,
	/\bpip3?\s+(list|show|freeze|check)\b/,
	/\bcargo\s+(--version|tree|metadata|pkgid)\b/,
	// Pure environment variable setup (no actual command follows)
	/^\s*(export\s+\w+=\S*\s*)+$/,
	// Build/test verification (read-only by nature — checks code, doesn't modify source)
	/\btsc\s+--noEmit\b/,
]

/**
 * Patterns that indicate a build/test/lint verification command.
 * These commands may produce output files (build artifacts, coverage),
 * but their PURPOSE is verification — they should not inflate execute counts.
 */
const VERIFICATION_PATTERNS: RegExp[] = [
	// JS/TS package manager scripts: bun/npm/yarn/pnpm run typecheck|build|test|lint|check
	/^\s*(?:bun|npm|yarn|pnpm)\s+(?:run\s+)?(?:typecheck|type-check|build|test|lint|check|verify|ci)\b/,
	// npx/bunx tool invocations
	/^\s*(?:npx|bunx)\s+(?:jest|vitest|mocha|eslint|prettier|tsc|biome|oxlint)\b/,
	// TypeScript compiler (any flag combo, not just --noEmit)
	/^\s*tsc\b/,
	// Rust
	/^\s*cargo\s+(?:test|check|clippy|build|bench)\b/,
	// Go
	/^\s*go\s+(?:test|vet|build)\b/,
	// Python
	/^\s*(?:python3?|py)\s+-m\s+(?:pytest|mypy|pylint|flake8|ruff|black\s+--check|isort\s+--check)\b/,
	// Make targets
	/^\s*make\s+(?:test|check|build|lint|verify|typecheck|ci)\b/,
	// JVM
	/^\s*(?:gradle|gradlew|mvn|mvnw)\s+(?:test|verify|check|build|compile)\b/,
]

/**
 * Determines whether a bash command is read-only / diagnostic.
 *
 * Returns `true` when the command is safe to treat as a "read" operation
 * (should not count against execution ratios or trigger pre-flight guards).
 *
 * Conservative: unknown commands → `false` (treated as execute, current behavior).
 * Performance: regex-only, < 1ms per call.
 */
export function isReadOnlyBashCommand(command: string): boolean {
	if (!command || !command.trim()) return true // empty command is harmless

	// Write indicators take absolute priority
	if (WRITE_INDICATORS.some((p) => p.test(command))) return false

	// Check for recognized read-only patterns
	if (READ_ONLY_PATTERNS.some((p) => p.test(command))) return true

	// Unknown command — conservative default
	return false
}

/**
 * Determines whether a bash command is a verification/build/test action.
 *
 * These commands may modify files (build artifacts, coverage reports),
 * but their PURPOSE is to verify code correctness — they should not
 * be blocked by cognitive gates or inflate execute-vs-read ratios.
 *
 * Note: `isReadOnlyBashCommand` is checked first in most call sites.
 * This function catches verification commands that aren't strictly read-only
 * (e.g., `bun run build` creates dist/ files).
 */
export function isVerificationBashCommand(command: string): boolean {
	if (!command || !command.trim()) return false

	return VERIFICATION_PATTERNS.some((p) => p.test(command))
}
