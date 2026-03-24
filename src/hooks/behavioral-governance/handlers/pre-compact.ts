import { getSessionState } from "../state"
import { buildPreCompactCheckpoint } from "../prompts/checkpoint"
import { log } from "../../../shared"

export function createPreCompactHandler() {
	return async (
		input: { sessionID: string },
		output: { context: string[] },
	): Promise<void> => {
		const state = getSessionState(input.sessionID)

		const checkpoint = buildPreCompactCheckpoint(state)
		output.context.push(checkpoint)

		log("[behavioral-governance] PreCompact checkpoint injected", {
			sessionID: input.sessionID,
			bashCount: state.bashCount,
			readCount: state.readCount,
			failures: state.consecutiveFailures,
			cognitiveComplete: state.cognitiveAnalysisCompleted,
		})
	}
}
