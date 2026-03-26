import type { SourceType } from "../cognitive-governance-shared/types"

const SOURCE_CLASSIFICATION: Record<string, SourceType> = {
	bash: "shell_command",

	read: "file_content",
	look_at: "file_content",

	edit: "file_modification",
	write: "file_modification",

	grep: "search_result",
	glob: "search_result",
	ast_grep_search: "search_result",
	ast_grep_replace: "search_result",

	lsp_diagnostics: "lsp_structured",
	lsp_find_references: "lsp_structured",
	lsp_goto_definition: "lsp_structured",
	lsp_symbols: "lsp_structured",
	lsp_rename: "lsp_structured",
	lsp_prepare_rename: "lsp_structured",

	webfetch: "web_content",
	websearch_web_search_exa: "web_content",
	grep_app_searchgithub: "web_content",
	context7_resolve_library_id: "web_content",
	"context7_resolve-library-id": "web_content",
	context7_query_docs: "web_content",
	"context7_query-docs": "web_content",

	task: "agent_output",
	background_output: "agent_output",
	background_cancel: "agent_output",

	question: "user_message",

	kgs_query: "search_result",

	session_list: "file_content",
	session_read: "file_content",
	session_search: "search_result",
	session_info: "file_content",

	task_create: "file_modification",
	task_update: "file_modification",
	task_get: "file_content",
	task_list: "file_content",

	skill: "file_content",
	skill_mcp: "agent_output",

	interactive_bash: "shell_command",
}

export function classifySource(toolName: string): SourceType {
	const normalized = toolName.toLowerCase().replace(/-/g, "_")
	return SOURCE_CLASSIFICATION[normalized] ?? SOURCE_CLASSIFICATION[toolName.toLowerCase()] ?? "unknown"
}

export function isSourceRegistered(toolName: string): boolean {
	const normalized = toolName.toLowerCase().replace(/-/g, "_")
	return normalized in SOURCE_CLASSIFICATION || toolName.toLowerCase() in SOURCE_CLASSIFICATION
}

const BUILD_COMMAND_PATTERN =
	/\b(tsc|typecheck|build|compile|webpack|vite\s+build|rollup|esbuild|swc|turbopack)\b/i
const TEST_COMMAND_PATTERN =
	/\b(vitest|jest|mocha|bun\s+test|npm\s+test|pnpm\s+test|yarn\s+test|pytest|go\s+test)\b/i

export function refineBashSource(command: string): SourceType {
	if (BUILD_COMMAND_PATTERN.test(command)) return "build_output"
	if (TEST_COMMAND_PATTERN.test(command)) return "test_output"
	return "shell_command"
}
