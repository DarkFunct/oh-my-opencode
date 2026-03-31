import type { MethodologyDimension } from "../cognitive-governance-shared/types"
import { REMEDIATION, type RemediationActionEN, type RemediationMapEN } from "../../config/gate-prompts"

export type { RemediationActionEN, RemediationMapEN }

export interface RemediationAction {
	readonly description: string
	readonly readTargets: readonly string[]
	readonly signalHints: readonly string[]
}

export type RemediationMap = Readonly<Record<MethodologyDimension, RemediationAction>>

/** @deprecated Use REMEDIATION.DEFAULT_REMEDIATION_MAP_EN from config/gate-prompts */
export const DEFAULT_REMEDIATION_MAP: RemediationMap = REMEDIATION.DEFAULT_REMEDIATION_MAP_EN

export function getMissingDimensions(
	covered: ReadonlySet<MethodologyDimension>,
): MethodologyDimension[] {
	const all: MethodologyDimension[] = ["technical", "empirical", "theoretical", "engineering", "philosophical"]
	return all.filter(d => !covered.has(d))
}

/** @deprecated Use REMEDIATION.buildRemediationGuideEN from config/gate-prompts */
export function buildRemediationGuide(
	missing: readonly MethodologyDimension[],
	map: RemediationMap = DEFAULT_REMEDIATION_MAP,
): string {
	return REMEDIATION.buildRemediationGuideEN(missing, map)
}
