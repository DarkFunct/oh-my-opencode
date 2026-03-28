import type { MethodologyPhase } from "./types"

const READ_TOOLS = new Set([
	"read", "glob", "grep", "ast_grep_search",
	"lsp_goto_definition", "lsp_find_references", "lsp_symbols", "lsp_diagnostics",
	"webfetch", "session_read", "session_search", "session_list",
	"look_at", "skill",
])

const PLAN_TOOLS = new Set([
	"task_create", "task_update", "task_list", "task_get",
	"question",
])

const EXECUTE_TOOLS = new Set([
	"edit", "write", "bash", "interactive_bash",
	"lsp_rename", "ast_grep_replace", "apply_patch",
])

export function classifyToolPhase(toolName: string): MethodologyPhase | null {
	const normalized = toolName.toLowerCase()

	if (READ_TOOLS.has(normalized)) return "read"
	if (EXECUTE_TOOLS.has(normalized)) return "execute"
	if (PLAN_TOOLS.has(normalized)) return "plan"

	if (normalized === "task") return "plan"

	return null
}

export function isExecuteTool(toolName: string): boolean {
	return EXECUTE_TOOLS.has(toolName.toLowerCase())
}

export function isReadTool(toolName: string): boolean {
	return READ_TOOLS.has(toolName.toLowerCase())
}

export function isTaskCompletionCall(
	toolName: string,
	args: Record<string, unknown>,
): boolean {
	const normalized = toolName.toLowerCase()
	if (normalized !== "task_update") return false
	return args.status === "completed"
}

export function isCaptureSignalPresent(output: string): boolean {
	const capturePatterns = [
		/capture[：:]/i,
		/知识沉淀/,
		/lessons.?learned/i,
		/无新增.{0,5}(知识|沉淀)/,
		/pitfalls?\.(md|json)/i,
		/_meta\/knowledge/,
		/更新.*文档/,
		/updated?.*doc/i,
	]

	return capturePatterns.some(p => p.test(output))
}

const CAPTURE_PATH_PATTERNS = [
	/_meta\/knowledge\//i,
	/lessons-learned\.(md|json)/i,
	/pitfalls?\.(md|json)/i,
	/constraints\.(md|json)/i,
	/decisions\.(md|json)/i,
	/\.sisyphus\/checkpoints\//i,
]

function extractPathsFromPatchText(patchText: string): string[] {
	const paths: string[] = []
	const regex = /^\*\*\*\s+(?:Add|Update|Delete)\s+File:\s+(.+)$/gim
	let match: RegExpExecArray | null = regex.exec(patchText)
	while (match) {
		paths.push(match[1].trim())
		match = regex.exec(patchText)
	}
	return paths
}

function extractCandidatePaths(args: Record<string, unknown>): string[] {
	const candidates: string[] = []
	if (typeof args.filePath === "string") candidates.push(args.filePath)
	if (typeof args.file_path === "string") candidates.push(args.file_path)
	if (typeof args.patchText === "string") {
		candidates.push(...extractPathsFromPatchText(args.patchText))
	}
	return candidates
}

export function isCaptureToolCall(
	toolName: string,
	args: Record<string, unknown>,
): boolean {
	if (!EXECUTE_TOOLS.has(toolName.toLowerCase())) return false
	const candidatePaths = extractCandidatePaths(args)
	if (candidatePaths.length === 0) return false
	return candidatePaths.some((path) => CAPTURE_PATH_PATTERNS.some((pattern) => pattern.test(path)))
}
