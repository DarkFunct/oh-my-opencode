import type { CognitiveReviewVerdictInput } from "../cognitive-governance-shared/review-state"

export function shouldRequestStageBReview(verdict: CognitiveReviewVerdictInput | null | undefined): boolean {
	if (!verdict) return false
	if (verdict.stage !== "A") return false
	return verdict.conclusion === "pending" || verdict.conclusion === "fail"
}

export function buildStageBReviewRequest(verdict: CognitiveReviewVerdictInput): string {
	const reasons = verdict.reasons.length > 0
		? verdict.reasons.map((reason, index) => `${index + 1}. ${reason}`).join("\n")
		: "1. 阶段 A 判定可疑，需要进一步复核"

	return [
		"[Stage B 认知复核请求]",
		"阶段 A 判定当前认知证据不足，请先做复核再继续执行工具。",
		"",
		"阶段 A 触发原因:",
		reasons,
		"",
		"请输出完整结构化结论（不要省略字段），格式如下：",
		"<cognitive_stage_b>{\"conclusion\":\"pass|fail\",\"layer\":\"perception|understanding|rationality\",\"dimensions\":[\"technical\",\"empirical\",\"theoretical\",\"engineering\",\"philosophical\"],\"confidence\":0.0,\"reasons\":[\"...\"]}</cognitive_stage_b>",
	].join("\n")
}
