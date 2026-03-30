import type { GovernanceConfig } from "../types"
import { getSessionState, incrementBashCount, incrementReadCount } from "../state"
import { detectSourceCodeModification } from "../source-code-detector"
import { evaluateDangerousCommand } from "../dangerous-command-gate"
import { buildCognitiveGatePrompt } from "../prompts/cognitive-gate"
import { buildSourceAuthPrompt } from "../prompts/source-auth"
import { buildExecutionRatioPrompt } from "../prompts/execution-ratio"
import { log, isReadOnlyBashCommand, isVerificationBashCommand } from "../../../shared"

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
		try {
			const safeArgs = output?.args ?? {}
			const state = getSessionState(input.sessionID)
			const toolLower = input.tool.toLowerCase()

			if (READ_TOOLS.has(toolLower)) {
				incrementReadCount(input.sessionID)
				return
			}

			if (toolLower !== "bash" && toolLower !== "edit" && toolLower !== "write") {
				return
			}

			const sourceCheck = detectSourceCodeModification(input.tool, safeArgs, config)
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

			if (toolLower === "bash") {
				const command = typeof safeArgs.command === "string" ? safeArgs.command : ""

				const dangerResult = evaluateDangerousCommand(command, config.dangerousCommandConfig)
				if (dangerResult.blocked && dangerResult.message) {
					log("[behavioral-governance] SC-03 dangerous command blocked", {
						sessionID: input.sessionID, category: dangerResult.category, severity: dangerResult.severity,
					})
					throw new Error(dangerResult.message)
				}

				if (isReadOnlyBashCommand(command) || isVerificationBashCommand(command)) {
					incrementReadCount(input.sessionID)
					return
				}

				if (state.readCount > 0 || !isDiagnosticBashCommand(command)) {
					const ratio = state.readCount > 0 ? state.bashCount / state.readCount : state.bashCount
					if (ratio > config.ratioThreshold && state.bashCount >= config.minBashSamplesForRatioGate) {
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

				incrementBashCount(input.sessionID)
			} else {
				if (!state.cognitiveAnalysisCompleted && state.readCount === 0) {
					log("[behavioral-governance] Cognitive gate triggered — first edit/write without prior read", {
						sessionID: input.sessionID,
						tool: toolLower,
					})
					throw new Error(buildCognitiveGatePrompt())
				}
			}
		} catch (e) {
			if (e instanceof Error && e.message.startsWith("[")) {
				throw e
			}
			log("[gaia-hook-safe] behavioral-governance toolExecuteBefore failed", { error: e })
		}
	}
}
