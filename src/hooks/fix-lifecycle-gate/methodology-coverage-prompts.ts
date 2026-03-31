import type { MethodologyDimension } from "../cognitive-governance-shared/types"
import type { TaskComplexity } from "./methodology-coverage-gate"
import type { RemediationMapEN } from "../../config/gate-prompts/remediation-prompts"
import { getMissingDimensions } from "./methodology-remediation-map"
import { REMEDIATION, INJECTION_PROMPT } from "../../config/gate-prompts"

export interface MethodologyCoverageBlockParams {
	readonly complexity: TaskComplexity
	readonly required: number
	readonly actual: number
	readonly deficit: number
	readonly warningCount: number
	readonly dimensionsCovered: ReadonlySet<MethodologyDimension>
	readonly remediationMap?: RemediationMapEN
}

export function buildMethodologyCoverageBlockMessage(params: MethodologyCoverageBlockParams): string {
	const {
		complexity, required, actual, deficit, warningCount,
		dimensionsCovered,
		remediationMap = REMEDIATION.DEFAULT_REMEDIATION_MAP_EN,
	} = params

	const coveredList = [...dimensionsCovered].join(", ") || "none"
	const missing = getMissingDimensions(dimensionsCovered)
	const missingList = missing.join(", ")
	const guide = REMEDIATION.buildRemediationGuideEN(missing, remediationMap)

	return REMEDIATION.methodologyCoverageBlock(
		complexity, required, actual, deficit,
		warningCount, coveredList, missingList, guide,
	)
}

export function buildMethodologyCoverageAbortMessage(params: MethodologyCoverageBlockParams & { readonly totalResponses: number }): string {
	const missing = getMissingDimensions(params.dimensionsCovered)
	const coveredList = [...params.dimensionsCovered].join(", ") || "none"

	return INJECTION_PROMPT.methodologyCoverageAbort(
		params.totalResponses, params.complexity,
		params.required, params.actual,
		coveredList, missing.join(", "),
	)
}
