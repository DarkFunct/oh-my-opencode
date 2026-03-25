import type { GovernanceConfig } from "../types"
import {
	getSessionState,
	recordFailure,
	resetFailures,
	markCognitiveAnalysisComplete,
	resetCheckpointCounter,
	grantSourceCodeAuth,
	consumeOnceAuthorization,
} from "../state"
import { buildCheckpointReminderSuffix } from "../prompts/checkpoint"
import {
	AUTH_LABEL_ONCE,
	AUTH_LABEL_TASK,
	AUTH_LABEL_SESSION,
} from "../prompts/source-auth"
import { log } from "../../../shared"

const FAILURE_INDICATORS = [
	/error:/i, /fatal:/i, /failed/i, /not found/i,
	/permission denied/i, /cannot/i, /unable to/i,
	/no such file/i, /command not found/i, /exit code [1-9]/i,
	/refused/i, /timeout/i, /exception/i,
]

const COGNITIVE_MARKERS = [
	/─── D1:.*Identity/i,
	/─── D2:.*Composition/i,
	/─── D3:.*Flow/i,
	/─── D4:.*Deployment/i,
	/─── D5:.*Impact/i,
]

const COGNITIVE_MARKERS_THRESHOLD = 3

function detectBashFailure(output: string): boolean {
	return FAILURE_INDICATORS.some((p) => p.test(output))
}

function detectCognitiveAnalysis(output: string): boolean {
	const matches = COGNITIVE_MARKERS.filter((p) => p.test(output)).length
	return matches >= COGNITIVE_MARKERS_THRESHOLD
}

function detectAuthorizationResponse(output: string): string | null {
	if (output.includes(AUTH_LABEL_SESSION)) return "session"
	if (output.includes(AUTH_LABEL_TASK)) return "task"
	if (output.includes(AUTH_LABEL_ONCE)) return "once"
	return null
}

export function createToolExecuteAfterHandler(config: GovernanceConfig) {
	return async (
		input: { tool: string; sessionID: string; callID: string },
		output: { title: string; output: string; metadata: Record<string, unknown> } | undefined,
	): Promise<void> => {
		try {
			if (!output) return

			const state = getSessionState(input.sessionID)
			const toolLower = input.tool.toLowerCase()
			const safeOutput = output.output ?? ""

			if (toolLower === "bash") {
				if (detectBashFailure(safeOutput)) {
					recordFailure(input.sessionID, safeOutput.slice(0, 300))
				} else {
					resetFailures(input.sessionID)
				}

				if (state.bashSinceCheckpoint >= config.checkpointInterval) {
					output.output = safeOutput + buildCheckpointReminderSuffix(state.bashSinceCheckpoint)
					resetCheckpointCounter(input.sessionID)
				}
			}

			if (toolLower === "question") {
				const authLevel = detectAuthorizationResponse(safeOutput)
				if (authLevel) {
					grantSourceCodeAuth(input.sessionID, authLevel as "once" | "task" | "session")
					log("[behavioral-governance] Source code authorization granted", {
						sessionID: input.sessionID,
						level: authLevel,
					})
				}
			}

			if (toolLower === "edit" || toolLower === "write") {
				consumeOnceAuthorization(input.sessionID)
			}

			if (!state.cognitiveAnalysisCompleted && detectCognitiveAnalysis(safeOutput)) {
				markCognitiveAnalysisComplete(input.sessionID)
				log("[behavioral-governance] Cognitive analysis detected — gate opened", {
					sessionID: input.sessionID,
				})
			}
		} catch (e) {
			log("[gaia-hook-safe] behavioralGovernance after failed", { error: e })
		}
	}
}
