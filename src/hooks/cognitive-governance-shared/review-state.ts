import type { CognitiveLayer, MethodologyDimension } from "./types"

export type CognitiveReviewConclusion = "pass" | "pending" | "fail"
export type CognitiveReviewStage = "A" | "B"
export type CognitiveReviewRisk = "low" | "medium" | "high"
export type CognitiveReviewSource = "gaia-stage-a" | "llm-stage-b"

export interface CognitiveReviewVerdictInput {
	conclusion: CognitiveReviewConclusion
	stage: CognitiveReviewStage
	layer: CognitiveLayer
	dimensions: MethodologyDimension[]
	confidence: number
	reasons: string[]
	risk: CognitiveReviewRisk
	source: CognitiveReviewSource
	registryVersion?: string
	fingerprint?: string
	loadedAt?: string
}

export interface CognitiveReviewVerdict extends CognitiveReviewVerdictInput {
	updatedAt: number
}

const verdicts = new Map<string, CognitiveReviewVerdict>()

export function setCognitiveReviewVerdict(
	sessionID: string,
	input: CognitiveReviewVerdictInput,
): void {
	verdicts.set(sessionID, {
		...input,
		dimensions: Array.from(new Set(input.dimensions)),
		reasons: [...input.reasons],
		updatedAt: Date.now(),
	})
}

export function getCognitiveReviewVerdict(sessionID: string): CognitiveReviewVerdict | null {
	return verdicts.get(sessionID) ?? null
}

export function clearCognitiveReviewVerdict(sessionID: string): void {
	verdicts.delete(sessionID)
}

export function _resetCognitiveReviewVerdictForTesting(): void {
	verdicts.clear()
}
