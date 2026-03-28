import type { SessionCognitiveState, MethodologyDimension } from "../cognitive-governance-shared/types"

const READ_TOOLS = new Set([
	"read", "glob", "grep", "ast_grep_search",
	"lsp_goto_definition", "lsp_find_references", "lsp_symbols", "lsp_diagnostics",
	"webfetch", "look_at", "skill",
])

const GREP_TOOLS = new Set(["grep", "ast_grep_search"])

const EXECUTE_TOOLS = new Set([
	"edit", "write", "bash", "interactive_bash", "ast_grep_replace", "lsp_rename",
	"apply_patch",
])

/**
 * File extensions that have no LSP server, so lsp_diagnostics cannot reset
 * the editsSinceLastVerification counter for them. Edits to these files
 * should NOT increment the counter (prevents perpetual F3 false positives).
 */
const NON_VERIFIABLE_EXTENSIONS = new Set([
	".md", ".mdx", ".txt", ".yaml", ".yml", ".json", ".toml",
])

const ALWAYS_VERIFIABLE_FILE_PATTERNS = [
	/(^|\/)tsconfig(?:\.[^/]+)?\.json$/i,
	/(^|\/)package\.json$/i,
	/(^|\/)bunfig\.toml$/i,
	/(^|\/)(?:vitest|jest)\.config\.[^/]+$/i,
]

export function isVerifiableFile(filePath: string): boolean {
	const lower = filePath.toLowerCase()
	if (ALWAYS_VERIFIABLE_FILE_PATTERNS.some((pattern) => pattern.test(lower))) {
		return true
	}

	const extensionStart = lower.lastIndexOf(".")
	if (extensionStart < 0) return true

	return !NON_VERIFIABLE_EXTENSIONS.has(
		lower.slice(extensionStart),
	)
}

const KNOWLEDGE_FILE_PATTERNS = [
	/_meta\/knowledge\//,
	/lessons-learned/,
	/pitfalls/,
	/constraints/,
	/decisions/,
]

const ARCHITECTURE_FILE_PATTERNS = [
	/docs\/architecture\//,
	/docs\/decisions\//,
	/AGENTS\.md/,
]

const ENGINEERING_FILE_PATTERNS = [
	/tsconfig.*\.json/,
	/package\.json/,
	/Makefile/,
	/docker-compose/,
	/\.env/,
	/Dockerfile/,
	/\.eslintrc/,
	/eslint\.config/,
	/vitest\.config/,
	/jest\.config/,
]

const PHILOSOPHICAL_FILE_PATTERNS = [
	/_meta\/harness\//,
	/methodology-chain/,
	/config\.ya?ml/,
	/cognitive-governance/,
	/\.sisyphus\/plans\//,
	/\.sisyphus\/checkpoints\//,
]

const EMPIRICAL_COMMAND_PATTERNS = [
	/\bbun\s+test\b/i,
	/\bnpm\s+(?:run\s+)?test\b/i,
	/\bpnpm\s+(?:run\s+)?test\b/i,
	/\byarn\s+(?:run\s+)?test\b/i,
	/\bvitest\b/i,
	/\bjest\b/i,
	/\bpytest\b/i,
	/\bgo\s+test\b/i,
	/\bcargo\s+test\b/i,
]

const ENGINEERING_COMMAND_PATTERNS = [
	/\bbun\s+run\s+build\b/i,
	/\bnpm\s+run\s+build\b/i,
	/\bpnpm\s+run\s+build\b/i,
	/\byarn\s+build\b/i,
	/\btsc\b/i,
	/\btypecheck\b/i,
	/\bdocker(?:-compose)?\b/i,
	/\bbun\s+install\b/i,
	/\bnpm\s+install\b/i,
	/\bpnpm\s+install\b/i,
	/\byarn\s+install\b/i,
]

export function isReadTool(tool: string): boolean {
	return READ_TOOLS.has(tool.toLowerCase())
}

export function isGrepTool(tool: string): boolean {
	return GREP_TOOLS.has(tool.toLowerCase())
}

export function isExecuteTool(tool: string): boolean {
	return EXECUTE_TOOLS.has(tool.toLowerCase())
}

export function isCaptureTarget(filePath: string): boolean {
	return KNOWLEDGE_FILE_PATTERNS.some((p) => p.test(filePath))
}

export function detectMethodologyDimension(
	state: SessionCognitiveState,
	tool: string,
	filePath?: string,
	commandText?: string,
): MethodologyDimension | null {
	const normalizedTool = tool.toLowerCase()

	if ((normalizedTool === "bash" || normalizedTool === "interactive_bash") && commandText) {
		if (EMPIRICAL_COMMAND_PATTERNS.some((pattern) => pattern.test(commandText))) {
			state.dimensionsCovered.add("empirical")
			return "empirical"
		}
		if (ENGINEERING_COMMAND_PATTERNS.some((pattern) => pattern.test(commandText))) {
			state.dimensionsCovered.add("engineering")
			return "engineering"
		}
	}

	// File-path-specific detection takes priority over generic tool detection
	// Reading tsconfig.json = engineering, reading _meta/harness/ = philosophical
	if (filePath) {
		if (PHILOSOPHICAL_FILE_PATTERNS.some((p) => p.test(filePath))) {
			state.dimensionsCovered.add("philosophical")
			return "philosophical"
		}
		if (ENGINEERING_FILE_PATTERNS.some((p) => p.test(filePath))) {
			state.dimensionsCovered.add("engineering")
			return "engineering"
		}
		if (KNOWLEDGE_FILE_PATTERNS.some((p) => p.test(filePath))) {
			state.dimensionsCovered.add("empirical")
			return "empirical"
		}
		if (ARCHITECTURE_FILE_PATTERNS.some((p) => p.test(filePath))) {
			state.dimensionsCovered.add("theoretical")
			return "theoretical"
		}
	}

	if (READ_TOOLS.has(normalizedTool) || normalizedTool === "bash") {
		state.dimensionsCovered.add("technical")
		return "technical"
	}

	return null
}
