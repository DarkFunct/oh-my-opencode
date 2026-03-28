import type { CognitiveReviewVerdict } from "../cognitive-governance-shared/review-state"

const LAYER_LABELS: Record<string, string> = {
	perception: "感知层 (Perception)",
	understanding: "悟性层 (Understanding)",
	rationality: "理性层 (Rationality)",
}

export function shouldBlockByCognitiveReview(
	verdict: CognitiveReviewVerdict | null,
): verdict is CognitiveReviewVerdict {
	if (!verdict) return false
	return verdict.conclusion === "pending" || verdict.conclusion === "fail"
}

export function buildCognitiveReviewBlockMessage(verdict: CognitiveReviewVerdict): string {
	const reasons = verdict.reasons.length > 0
		? verdict.reasons.map((reason, index) => `${index + 1}. ${reason}`).join("\n")
		: "1. 阶段 A 评估判定需补充认知证据"

	return [
		"[Cognitive Review Gate] 执行操作被拦截",
		"",
		`结论: ${verdict.conclusion.toUpperCase()} (Stage ${verdict.stage}, risk=${verdict.risk}, confidence=${verdict.confidence.toFixed(2)})`,
		`当前层级: ${LAYER_LABELS[verdict.layer] ?? verdict.layer}`,
		`方法论覆盖维度: ${verdict.dimensions.join(", ") || "(none)"}`,
		"",
		"触发原因:",
		reasons,
		"",
		"请先补齐：证据绑定、因果链、验证计划；必要时补哲学维度的前提反思后再执行工具。",
	].join("\n")
}
