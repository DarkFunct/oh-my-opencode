import type { CognitiveAssessment } from "./conversation-analyzer"
import type { CognitiveLayer } from "../cognitive-governance-shared/types"

const LAYER_LABELS: Record<CognitiveLayer, string> = {
	perception: "感知层 (Perception)",
	understanding: "悟性层 (Understanding)",
	rationality: "理性层 (Rationality)",
}

export function buildCognitiveDirective(assessment: CognitiveAssessment): string | null {
	const parts: string[] = []

	if (assessment.dimensionsGap.length > 0 && assessment.dimensionsCovered.length < 3) {
		parts.push(buildDimensionGapReminder(assessment))
	}

	if (assessment.unresolvedErrors > 0 && assessment.fixAttempts > 1) {
		parts.push(buildErrorGuidance(assessment))
	}

	if (assessment.editedFilesCount > 0 && !assessment.hasVerification) {
		parts.push(buildVerificationReminder(assessment))
	}

	if (assessment.captureNeeded) {
		parts.push(buildCaptureEscalation(assessment))
	}

	if (parts.length === 0) return null

	return [
		"[Harness 认知治理 — 当前状态]",
		`认知层级: ${LAYER_LABELS[assessment.currentLayer]}`,
		`方法论覆盖: ${assessment.dimensionsCovered.join(", ") || "无"}`,
		"",
		...parts,
	].join("\n")
}

function buildDimensionGapReminder(assessment: CognitiveAssessment): string {
	const gapNames = assessment.dimensionsGap.slice(0, 3).join(", ")
	return [
		"⚠️ 方法论覆盖不足",
		`已覆盖: ${assessment.dimensionsCovered.join(", ")}`,
		`未覆盖: ${gapNames}`,
		"建议扩展认知维度后再推进执行。",
	].join("\n")
}

function buildErrorGuidance(assessment: CognitiveAssessment): string {
	return [
		"⚠️ 未解决错误仍存在",
		`错误数: ${assessment.unresolvedErrors}, 修复尝试: ${assessment.fixAttempts}`,
		"请回到感知层重新取证，避免反复修症状。",
	].join("\n")
}

function buildVerificationReminder(assessment: CognitiveAssessment): string {
	return [
		"📋 验证提醒",
		`已编辑 ${assessment.editedFilesCount} 个文件，尚无构建/测试验证。`,
		"理性层要求：执行后须回到感知层验证结果。",
	].join("\n")
}

function buildCaptureEscalation(assessment: CognitiveAssessment): string {
	if (assessment.captureUrgency === "critical") {
		return [
			"🚨 **Capture 阶段严重逾期 — 即将被拦截**",
			`已编辑 ${assessment.editedFilesCount} 个文件，方法论链 Capture 阶段仍未执行。`,
			"下一轮对话将被 L2 硬拦截，禁止一切非 Capture 操作。",
			"**立即执行**：写入 _meta/knowledge/ 下的经验/陷阱/决策文档。",
		].join("\n")
	}
	if (assessment.captureUrgency === "warning") {
		return [
			"⚠️ **Capture 阶段逾期**",
			`已编辑 ${assessment.editedFilesCount} 个文件，Capture 未执行。`,
			"方法论链: Read → Plan → Execute → **Capture(知识沉淀)**",
			"请尽快写入经验教训/陷阱/决策到 _meta/knowledge/。",
		].join("\n")
	}
	return [
		"📝 Capture 提醒",
		`Execute 阶段已产生实质性变更 (${assessment.editedFilesCount} 文件)。`,
		"完成当前工作后记得进入 Capture 阶段（知识沉淀）。",
	].join("\n")
}
