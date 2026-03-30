import type { DeliveryEvidence } from "../cognitive-governance-shared/types"
import type { FixLifecycleGateConfig } from "./config"

export type DeliveryGateReason = "build_stale" | "build_failed" | "tests_failed" | null

export interface DeliveryGateResult {
	shouldBlock: boolean
	reason: DeliveryGateReason
	evidence: DeliveryEvidence
}

export function evaluateDeliveryReadiness(
	evidence: DeliveryEvidence,
	priorWarnings: number,
	config: FixLifecycleGateConfig,
): DeliveryGateResult {
	if (evidence.buildExitCode !== null && evidence.buildExitCode !== 0) {
		return { shouldBlock: true, reason: "build_failed", evidence }
	}

	if (evidence.lastTestResult === "fail") {
		return { shouldBlock: true, reason: "tests_failed", evidence }
	}

	if (evidence.codeChangesSinceBuild > 0) {
		const shouldBlock = priorWarnings >= config.dvWarningThreshold
		return { shouldBlock, reason: "build_stale", evidence }
	}

	return { shouldBlock: false, reason: null, evidence }
}
