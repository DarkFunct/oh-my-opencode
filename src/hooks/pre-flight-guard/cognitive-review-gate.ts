import type { CognitiveReviewVerdict } from "../cognitive-governance-shared/review-state"
import { GATE_PROMPT } from "../../config/gate-prompts"

export function shouldBlockByCognitiveReview(
	verdict: CognitiveReviewVerdict | null,
): verdict is CognitiveReviewVerdict {
	if (!verdict) return false
	return verdict.conclusion === "pending" || verdict.conclusion === "fail"
}

export function buildCognitiveReviewBlockMessage(verdict: CognitiveReviewVerdict): string {
	return GATE_PROMPT.cognitiveReviewBlock(
		verdict.conclusion,
		verdict.stage,
		verdict.risk,
		verdict.confidence,
		verdict.layer,
		verdict.dimensions,
		verdict.reasons,
	)
}
