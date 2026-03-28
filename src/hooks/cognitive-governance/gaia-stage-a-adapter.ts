import {
	evaluateCognitiveSignals,
	loadCognitiveSignalRegistry,
	type EvaluateCognitiveSignalsOptions,
} from "@gaia/omo-hooks"
import type { CognitiveLayer, MethodologyDimension, SessionCognitiveState } from "../cognitive-governance-shared/types"
import type { CognitiveReviewVerdictInput } from "../cognitive-governance-shared/review-state"

interface GaiaStageAResult {
	layer: CognitiveLayer
	dimensionsCovered: MethodologyDimension[]
	verdict: CognitiveReviewVerdictInput
}

export type GaiaStageAEvaluationOptions = EvaluateCognitiveSignalsOptions

const registry = loadCognitiveSignalRegistry()

function deriveConclusion(result: { suspicious: boolean; risk: "low" | "medium" | "high" }): "pass" | "pending" | "fail" {
	if (!result.suspicious) return "pass"
	if (result.risk === "high") return "fail"
	return "pending"
}

function deriveConfidence(risk: "low" | "medium" | "high"): number {
	if (risk === "low") return 0.9
	if (risk === "medium") return 0.65
	return 0.8
}

export function evaluateGaiaStageAFromThinking(
	thinkingContent: string,
	options?: GaiaStageAEvaluationOptions,
): GaiaStageAResult | null {
	const normalized = thinkingContent.trim()
	if (!normalized) return null

	const result = evaluateCognitiveSignals(normalized, registry, options)
	return {
		layer: result.layer,
		dimensionsCovered: result.dimensionsCovered,
		verdict: {
			conclusion: deriveConclusion(result),
			stage: "A",
			layer: result.layer,
			dimensions: result.dimensionsCovered,
			confidence: deriveConfidence(result.risk),
			reasons: result.reasons,
			risk: result.risk,
			source: "gaia-stage-a",
			registryVersion: result.registryVersion,
			fingerprint: result.fingerprint,
			loadedAt: result.loadedAt,
		},
	}
}

export function evaluateGaiaStageA(
	state: SessionCognitiveState,
	options?: GaiaStageAEvaluationOptions,
): GaiaStageAResult | null {
	if (state.cognitiveEvidence.length === 0) {
		return null
	}

	const thinkingContent = state.cognitiveEvidence
		.map((evidence) => `${evidence.layer} ${evidence.dimension} ${evidence.signal}`)
		.join("\n")

	if (!thinkingContent.trim()) {
		return null
	}

	return evaluateGaiaStageAFromThinking(thinkingContent, options)
}
