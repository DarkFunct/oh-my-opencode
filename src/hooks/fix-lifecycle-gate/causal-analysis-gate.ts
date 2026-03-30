import type { SessionCognitiveState } from "../cognitive-governance-shared/types"
import type { FixLifecycleGateConfig } from "./config"

export type CausalAnalysisStep = "problem_statement" | "causal_chain" | "counterfactual"

export interface CausalAnalysisGateResult {
	shouldBlock: boolean
	reason: "ca_required" | null
	requiredSteps: CausalAnalysisStep[]
}

export function evaluateCausalAnalysisRequired(
	state: SessionCognitiveState,
	config: FixLifecycleGateConfig,
): CausalAnalysisGateResult {
	if (state.consecutiveFixFailures < config.caTrigggerFailures) {
		return { shouldBlock: false, reason: null, requiredSteps: [] }
	}

	if (state.newFilesReadSinceLastFailure >= config.caRequiredReadsBeforeRetry) {
		return { shouldBlock: false, reason: null, requiredSteps: [] }
	}

	const requiredSteps: CausalAnalysisStep[] = ["problem_statement", "causal_chain"]
	if (state.consecutiveFixFailures >= 3) {
		requiredSteps.push("counterfactual")
	}

	return { shouldBlock: true, reason: "ca_required", requiredSteps }
}
