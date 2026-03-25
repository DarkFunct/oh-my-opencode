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
