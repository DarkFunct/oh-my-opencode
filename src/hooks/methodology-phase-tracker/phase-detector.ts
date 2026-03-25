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
	"lsp_rename", "ast_grep_replace",
])

const CAPTURE_TOOLS = new Set([
	"task_update",
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
