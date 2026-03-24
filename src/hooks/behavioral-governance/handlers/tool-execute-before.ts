import type { GovernanceConfig } from "../types"
import { getSessionState, incrementBashCount, incrementReadCount } from "../state"
import { detectSourceCodeModification } from "../source-code-detector"
import { buildCognitiveGatePrompt } from "../prompts/cognitive-gate"
import { buildCircuitBreakerPrompt } from "../prompts/circuit-breaker"
import { buildSourceAuthPrompt } from "../prompts/source-auth"
import { buildExecutionRatioPrompt } from "../prompts/execution-ratio"
import { log } from "../../../shared"

const READ_TOOLS = new Set([
	"read", "grep", "glob", "ast_grep_search",
	"lsp_goto_definition", "lsp_find_references", "lsp_symbols",
	"lsp_diagnostics", "lsp_prepare_rename", "webfetch", "look_at",
])

const DIAGNOSTIC_BASH_PATTERNS = [
	/\bcurl\b/, /\bwget\b/, /\bssh\b.*\b(cat|grep|tail|head|ls|find|ps|systemctl|journalctl)\b/,
	/\bphp\b/, /\bgo\b.*\brun\b/, /\bnpm\b/, /\bnode\b/,
	/\bsed\s+-i\b/, /\bmysql\b/, /\bredis-cli\b/,
]

function isDiagnosticBashCommand(command: string): boolean {
	return DIAGNOSTIC_BASH_PATTERNS.some((p) => p.test(command))
}

export function createToolExecuteBeforeHandler(config: GovernanceConfig) {
	return async (
		input: { tool: string; sessionID: string; callID: string },
		output: { args: Record<string, unknown>; message?: string },
	): Promise<void> => {
		const state = getSessionState(input.sessionID)
		const toolLower = input.tool.toLowerCase()

		if (READ_TOOLS.has(toolLower)) {
			incrementReadCount(input.sessionID)
			return
		}

		if (toolLower !== "bash" && toolLower !== "edit" && toolLower !== "write") {
			return
		}

		const sourceCheck = detectSourceCodeModification(input.tool, output.args, config)
		if (sourceCheck.detected) {
			const auth = state.sourceCodeAuth
			if (auth.level === "none") {
				log("[behavioral-governance] Source code modification blocked — no authorization", {
					sessionID: input.sessionID,
					filePath: sourceCheck.filePath,
				})
				throw new Error(buildSourceAuthPrompt(
					sourceCheck.filePath ?? "unknown",
					sourceCheck.operationType ?? "unknown",
				))
			}
		}

		if (toolLower !== "bash") return

		const command = typeof output.args.command === "string" ? output.args.command : ""

		if (state.readCount > 0 || !isDiagnosticBashCommand(command)) {
			const ratio = state.readCount > 0 ? state.bashCount / state.readCount : state.bashCount
			if (ratio > config.ratioThreshold && state.bashCount >= 6) {
				const required = Math.ceil(state.bashCount / config.ratioThreshold) - state.readCount
				log("[behavioral-governance] Execution ratio exceeded", {
					sessionID: input.sessionID,
					bash: state.bashCount,
					read: state.readCount,
					ratio,
				})
				throw new Error(buildExecutionRatioPrompt(
					state.bashCount,
					state.readCount,
					config.ratioThreshold,
					Math.max(required, 2),
				))
			}
		}

		if (!state.cognitiveAnalysisCompleted && state.bashCount === 0 && isDiagnosticBashCommand(command)) {
			log("[behavioral-governance] Cognitive gate triggered — first diagnostic bash without analysis", {
				sessionID: input.sessionID,
			})
			throw new Error(buildCognitiveGatePrompt())
		}

		if (state.consecutiveFailures >= config.failureThreshold) {
			log("[behavioral-governance] Circuit breaker triggered", {
				sessionID: input.sessionID,
				failures: state.consecutiveFailures,
			})
			throw new Error(buildCircuitBreakerPrompt(
				state.consecutiveFailures,
				state.lastFailureContext,
			))
		}

		incrementBashCount(input.sessionID)
	}
}
