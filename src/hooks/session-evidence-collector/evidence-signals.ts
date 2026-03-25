import type { SessionCognitiveState, MethodologyDimension } from "../cognitive-governance-shared/types"

const READ_TOOLS = new Set([
	"read", "glob", "grep", "ast_grep_search",
	"lsp_goto_definition", "lsp_find_references", "lsp_symbols", "lsp_diagnostics",
	"webfetch", "look_at", "skill",
])

const GREP_TOOLS = new Set(["grep", "ast_grep_search"])

const EXECUTE_TOOLS = new Set([
	"edit", "write", "bash", "interactive_bash", "ast_grep_replace", "lsp_rename",
])

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
): MethodologyDimension | null {
	const normalizedTool = tool.toLowerCase()

	if (READ_TOOLS.has(normalizedTool) || normalizedTool === "bash") {
		state.dimensionsCovered.add("technical")
		return "technical"
	}

	if (filePath) {
		if (KNOWLEDGE_FILE_PATTERNS.some((p) => p.test(filePath))) {
			state.dimensionsCovered.add("empirical")
			return "empirical"
		}
		if (ARCHITECTURE_FILE_PATTERNS.some((p) => p.test(filePath))) {
			state.dimensionsCovered.add("theoretical")
			return "theoretical"
		}
	}

	return null
}
