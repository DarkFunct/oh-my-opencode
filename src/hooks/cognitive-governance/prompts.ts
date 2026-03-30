import type { CognitiveAssessment } from "./conversation-analyzer"
import type { CognitiveLayer } from "../cognitive-governance-shared/types"
import { DEFAULT_REMEDIATION_MAP } from "../fix-lifecycle-gate/methodology-remediation-map"

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

	if (assessment.pendingVerificationEditsCount > 0) {
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
	const lines: string[] = [
		"⚠️ 方法论覆盖不足",
		`已覆盖: ${assessment.dimensionsCovered.join(", ")}`,
		`未覆盖: ${assessment.dimensionsGap.slice(0, 3).join(", ")}`,
		"",
		"**各缺失维度的操作指引：**",
	]

	for (const dim of assessment.dimensionsGap.slice(0, 3)) {
		const action = DEFAULT_REMEDIATION_MAP[dim]
		if (action) {
			lines.push(`- **${dim}** (${action.description}):`)
			for (const target of action.readTargets) {
				lines.push(`    → ${target}`)
			}
		}
	}

	lines.push("", "完成以上任意缺失维度的操作后，覆盖将自动更新。")
	return lines.join("\n")
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
		`当前有 ${assessment.pendingVerificationEditsCount} 次可验证编辑尚未完成构建/测试验证。`,
		"理性层要求：执行后须回到感知层验证结果。",
	].join("\n")
}

function buildCaptureEscalation(assessment: CognitiveAssessment): string {
	if (assessment.captureUrgency === "critical") {
		return [
			"🚨 **Capture 阶段严重逾期 — 即将被拦截**",
			`已编辑 ${assessment.editedFilesCount} 个文件，方法论链 Capture 阶段仍未执行。`,
			"下一轮对话将被 L2 硬拦截，禁止一切非 Capture 操作。",
			"**立即执行** — 写入 _meta/knowledge/ 下的知识沉淀文档：",
			"  • 经验教训 (L-xxx): lessons-learned.md — 问题→诊断→修复→提炼",
			"  • 已知陷阱 (P-xxx): pitfalls.md — 症状→根因→修复",
			"  • 架构决策 (D-xxx): decisions.md — 背景→方案→理由",
			"  • 约束登记 (C-xxx): constraints.md — 约束→级别→来源",
		].join("\n")
	}
	if (assessment.captureUrgency === "warning") {
		return [
			"⚠️ **Capture 阶段逾期**",
			`已编辑 ${assessment.editedFilesCount} 个文件，Capture 未执行。`,
			"方法论链: Read → Plan → Execute → **Capture(知识沉淀)**",
			"请尽快写入 _meta/knowledge/：经验(L-xxx) / 陷阱(P-xxx) / 决策(D-xxx) / 约束(C-xxx)。",
		].join("\n")
	}
	return [
		"📝 Capture 提醒",
		`Execute 阶段已产生实质性变更 (${assessment.editedFilesCount} 文件)。`,
		"完成当前工作后记得进入 Capture 阶段（知识沉淀）。",
		"沉淀维度：经验(L-xxx) / 陷阱(P-xxx) / 决策(D-xxx) / 约束(C-xxx)。",
	].join("\n")
}
