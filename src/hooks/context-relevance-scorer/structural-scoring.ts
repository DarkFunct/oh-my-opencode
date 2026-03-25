import type { DetectedError, SessionCognitiveState, StructuralScoring } from "../cognitive-governance-shared/types"
import { DEFAULT_DECAY_WINDOW, DEFAULT_MAX_EXPECTED_CITATIONS } from "./scoring-config"

export function computeRecency(error: DetectedError, currentRound: number): number {
	const evidenceRound = error.round ?? 0
	return Math.max(0, 1 - (currentRound - evidenceRound) / DEFAULT_DECAY_WINDOW)
}

export function computeCitation(error: DetectedError, citationMap: Map<string, number>): number {
	if (!error.filePath) return 0
	const count = citationMap.get(error.filePath) ?? 0
	return Math.min(count / DEFAULT_MAX_EXPECTED_CITATIONS, 1.0)
}

export function computeSuperseded(error: DetectedError, allErrors: DetectedError[]): number {
	if (!error.filePath) return 1
	const hasNewer = allErrors.some(
		(other) =>
			other !== error &&
			other.filePath === error.filePath &&
			other.timestamp > error.timestamp,
	)
	return hasNewer ? 0 : 1
}

export function computeStructuralScoring(
	error: DetectedError,
	state: SessionCognitiveState,
): StructuralScoring {
	return {
		recency: computeRecency(error, state.roundCounter),
		citation: computeCitation(error, state.citationMap),
		superseded: computeSuperseded(error, state.detectedErrors),
	}
}
