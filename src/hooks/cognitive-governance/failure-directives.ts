import type { SessionCognitiveState } from "../cognitive-governance-shared/types"
import { computeFixTargetConsistency, hasReadKnowledgeFiles } from "../session-evidence-collector/failure-signals"
import { SOFT_PROMPT } from "../../config/gate-prompts"

const F3_WARN_THRESHOLD = 4

export function detectCognitiveFailureWarn(
	state: SessionCognitiveState,
): string | null {
	if (state.detectedErrors.length > 0 && state.fileEditHistory.size > 0) {
		const consistency = computeFixTargetConsistency(state)
		if (consistency < 1.0) {
			const errorFiles = state.detectedErrors
				.map((e) => e.filePath)
				.filter((f): f is string => !!f)
			const editedFiles = [...state.fileEditHistory.keys()]
			return buildF2Directive([...new Set(errorFiles)], editedFiles, consistency)
		}
	}

	if (state.editsSinceLastVerification >= F3_WARN_THRESHOLD) {
		return SOFT_PROMPT.f3Warn(state.editsSinceLastVerification)
	}

	if (state.executePhaseActive && !hasReadKnowledgeFiles(state)) {
		return SOFT_PROMPT.f4WarnBeforeExecute()
	}

	if (
		state.consecutiveFixFailures > 0 &&
		!state.knowledgeReadSinceLastFailure
	) {
		return SOFT_PROMPT.f4WarnAfterFailure()
	}

	return null
}

function buildF2Directive(errorFiles: string[], editedFiles: string[], consistency: number): string {
	if (consistency === 0) {
		return SOFT_PROMPT.f2WarnZeroOverlap(errorFiles, editedFiles)
	}
	const pct = Math.round(consistency * 100)
	return SOFT_PROMPT.f2WarnPartialOverlap(errorFiles, pct)
}
