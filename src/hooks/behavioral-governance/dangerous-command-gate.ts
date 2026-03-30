export interface DangerousCommandResult {
	blocked: boolean
	command: string
	category: string | null
	severity: "critical" | "high" | null
	layer: "A" | "B" | null
	message: string | null
}

export interface DangerousCommandConfig {
	enabled?: boolean
	default_patterns_enabled?: boolean
	custom_patterns?: Array<{ category: string; pattern: string; severity: "critical" | "high" }>
	safe_rm_paths?: string[]
}

interface CommandPattern {
	category: string
	regex: RegExp
	severity: "critical" | "high"
}

const LAYER_A_PATTERNS: readonly CommandPattern[] = [
	{ category: "destructive_file", regex: /rm\s+(-[rf]+\s+)*(\/|~|\$HOME|\.\.\/)/, severity: "critical" },
	{ category: "force_push", regex: /git\s+push\s+.*--force(?!-)/, severity: "critical" },
	{ category: "force_push", regex: /git\s+push\s+-f\b/, severity: "critical" },
	{ category: "database_drop", regex: /DROP\s+(TABLE|DATABASE|SCHEMA)\b/i, severity: "critical" },
	{ category: "disk_format", regex: /mkfs\.\w+\s+\/dev\//, severity: "critical" },
] as const

const DEFAULT_LAYER_B_PATTERNS: readonly CommandPattern[] = [
	{ category: "destructive_file", regex: /rm\s+-rf\s+[^\s]+/, severity: "high" },
	{ category: "hard_reset", regex: /git\s+reset\s+--hard/, severity: "high" },
	{ category: "database_truncate", regex: /TRUNCATE\s+TABLE\b/i, severity: "high" },
	{ category: "permission_change", regex: /chmod\s+(-R\s+)?777\s+\//, severity: "high" },
	{ category: "history_rewrite", regex: /git\s+rebase\s+.*--force/, severity: "high" },
] as const

const DEFAULT_SAFE_RM_PATHS = ["dist/", "build/", "node_modules/", ".next/", "coverage/", "tmp/", ".cache/"]

const NOT_BLOCKED: DangerousCommandResult = {
	blocked: false,
	command: "",
	category: null,
	severity: null,
	layer: null,
	message: null,
}

function stripCommentAndQuotedContent(command: string): string {
	if (command.trimStart().startsWith("#")) return ""
	if (/^echo\s+["']/i.test(command.trimStart())) return ""
	return command
}

function isInSafeRmPaths(command: string, safePaths: string[]): boolean {
	const rmMatch = command.match(/rm\s+-rf\s+(\S+)/)
	if (!rmMatch) return false
	const targetPath = rmMatch[1]
	return safePaths.some((safe) => targetPath === safe || targetPath.endsWith("/" + safe))
}

export function evaluateDangerousCommand(
	command: string,
	config?: DangerousCommandConfig,
): DangerousCommandResult {
	const cleaned = stripCommentAndQuotedContent(command)
	if (!cleaned.trim()) return { ...NOT_BLOCKED, command }

	for (const pat of LAYER_A_PATTERNS) {
		if (pat.regex.test(cleaned)) {
			return {
				blocked: true,
				command,
				category: pat.category,
				severity: pat.severity,
				layer: "A",
				message: formatMessage(command, pat.category, pat.severity),
			}
		}
	}

	const enabled = config?.enabled ?? true
	if (!enabled) return { ...NOT_BLOCKED, command }

	const defaultPatternsEnabled = config?.default_patterns_enabled ?? true
	const safePaths = config?.safe_rm_paths ?? DEFAULT_SAFE_RM_PATHS
	const layerBPatterns: CommandPattern[] = defaultPatternsEnabled ? [...DEFAULT_LAYER_B_PATTERNS] : []

	if (config?.custom_patterns) {
		for (const cp of config.custom_patterns) {
			try {
				layerBPatterns.push({ category: cp.category, regex: new RegExp(cp.pattern), severity: cp.severity })
			} catch {
				// skip invalid regex
			}
		}
	}

	for (const pat of layerBPatterns) {
		if (pat.regex.test(cleaned)) {
			if (pat.category === "destructive_file" && isInSafeRmPaths(cleaned, safePaths)) continue
			return {
				blocked: true,
				command,
				category: pat.category,
				severity: pat.severity,
				layer: "B",
				message: formatMessage(command, pat.category, pat.severity),
			}
		}
	}

	return { ...NOT_BLOCKED, command }
}

function formatMessage(command: string, category: string, severity: string): string {
	const truncated = command.length > 80 ? command.slice(0, 77) + "..." : command
	return (
		`[🛑 SC-03 Dangerous Command Gate] 检测到不可逆操作 (${category}, ${severity})\n` +
		`命令: ${truncated}\n` +
		`请先创建回退点（如 git stash / cp -r）再执行高风险操作。`
	)
}
