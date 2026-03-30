import type { MethodologyDimension } from "../cognitive-governance-shared/types"
import type { TaskComplexity } from "./methodology-coverage-gate"
import type { RemediationMap } from "./methodology-remediation-map"
import { getMissingDimensions, buildRemediationGuide, DEFAULT_REMEDIATION_MAP } from "./methodology-remediation-map"

export interface MethodologyCoverageBlockParams {
	readonly complexity: TaskComplexity
	readonly required: number
	readonly actual: number
	readonly deficit: number
	readonly warningCount: number
	readonly dimensionsCovered: ReadonlySet<MethodologyDimension>
	readonly remediationMap?: RemediationMap
}

export function buildMethodologyCoverageBlockMessage(params: MethodologyCoverageBlockParams): string {
	const {
		complexity, required, actual, deficit, warningCount,
		dimensionsCovered,
		remediationMap = DEFAULT_REMEDIATION_MAP,
	} = params

	const coveredList = [...dimensionsCovered].join(", ") || "无"
	const missing = getMissingDimensions(dimensionsCovered)
	const missingList = missing.join(", ")

	const lines: string[] = [
		`[🛑 Methodology Coverage] 任务复杂度 ${complexity}，要求 ${required} 维方法论覆盖，当前仅 ${actual} 维（差 ${deficit}）。`,
		"",
		`已覆盖维度: ${coveredList}`,
		`缺失维度: ${missingList}`,
		`已连续警告: ${warningCount} 次`,
		"",
		buildRemediationGuide(missing, remediationMap),
		"完成以上任意缺失维度的操作后，门控将自动解除。",
	]

	return lines.join("\n")
}

export function buildMethodologyCoverageAbortMessage(params: MethodologyCoverageBlockParams & { readonly totalResponses: number }): string {
	const missing = getMissingDimensions(params.dimensionsCovered)
	const coveredList = [...params.dimensionsCovered].join(", ") || "无"

	return [
		`[🛑 Methodology Coverage — 终止说明]`,
		"",
		`经过 ${params.totalResponses} 次响应尝试，方法论覆盖仍未满足要求。`,
		`任务复杂度: ${params.complexity}，要求: ${params.required} 维，实际: ${params.actual} 维`,
		`已覆盖: ${coveredList}`,
		`仍缺失: ${missing.join(", ")}`,
		"",
		"Session 即将终止。如需继续，请在新会话中先完成缺失维度的认知操作。",
	].join("\n")
}
