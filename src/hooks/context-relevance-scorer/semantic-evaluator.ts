import type { SemanticEvaluation } from "../cognitive-governance-shared/types"

/**
 * JSON Schema for validating LLM semantic evaluation output.
 * Non-conforming output is discarded → fallback to structural_only.
 */
export const SEMANTIC_OUTPUT_SCHEMA = {
	type: "object" as const,
	required: ["taskRelevance", "causalContribution", "evidence"],
	properties: {
		taskRelevance: { type: "number" as const, minimum: 0, maximum: 1 },
		causalContribution: { type: "number" as const, minimum: 0, maximum: 1 },
		evidence: { type: "array" as const, items: { type: "string" as const }, minItems: 1 },
	},
	additionalProperties: false,
} as const

/**
 * Phase β stub: semantic evaluation is not yet implemented.
 * Always returns null → fusion falls back to structural_only track.
 * Phase γ+ will implement actual LLM-based evaluation.
 */
export function evaluateSemantic(): SemanticEvaluation | null {
	return null
}
