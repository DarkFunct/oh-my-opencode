// C-017: only structured params (command, filePath, pattern), never NL prompts
const TOOL_ARG_MAP: Record<string, string> = {
	bash: "command",
	edit: "filePath",
	write: "filePath",
	read: "filePath",
	grep: "pattern",
	glob: "pattern",
	ast_grep_search: "pattern",
	ast_grep_replace: "pattern",
	lsp_rename: "newName",
	lsp_diagnostics: "filePath",
	lsp_goto_definition: "filePath",
	lsp_find_references: "filePath",
	skill: "name",
}

export function extractMatchableArg(
	tool: string,
	args: Record<string, unknown>,
	argName: string,
): string | null {
	const key = argName === "command" || argName === "filePath" || argName === "pattern" || argName === "name" || argName === "newName"
		? argName
		: TOOL_ARG_MAP[tool] ?? null

	if (!key) return null

	const value = args[key]
	return typeof value === "string" ? value : null
}

export function extractConditionArg(
	args: Record<string, unknown>,
	argName: string,
): string | null {
	const value = args[argName]
	return typeof value === "string" ? value : null
}
