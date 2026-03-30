import { describe, expect, test } from "bun:test"
import { getCognitiveState, deleteCognitiveSession } from "../cognitive-governance-shared/state"
import { evaluateCausalAnalysisRequired, type CausalAnalysisGateResult } from "./causal-analysis-gate"
import { DEFAULT_FIX_LIFECYCLE_GATE_CONFIG } from "./config"

function freshState(id: string) {
	deleteCognitiveSession(id)
	return getCognitiveState(id)
}

describe("causal-analysis-gate", () => {
	test("no block when consecutive failures below threshold", () => {
		const state = freshState("ca-below")
		state.consecutiveFixFailures = 1
		const result = evaluateCausalAnalysisRequired(state, DEFAULT_FIX_LIFECYCLE_GATE_CONFIG)
		expect(result.shouldBlock).toBe(false)
		expect(result.reason).toBeNull()
		deleteCognitiveSession("ca-below")
	})

	test("blocks when failures >= threshold and no reads since failure", () => {
		const state = freshState("ca-block")
		state.consecutiveFixFailures = 2
		state.newFilesReadSinceLastFailure = 0
		const result = evaluateCausalAnalysisRequired(state, DEFAULT_FIX_LIFECYCLE_GATE_CONFIG)
		expect(result.shouldBlock).toBe(true)
		expect(result.reason).toBe("ca_required")
		expect(result.requiredSteps).toContain("problem_statement")
		expect(result.requiredSteps).toContain("causal_chain")
		deleteCognitiveSession("ca-block")
	})

	test("no block when failures >= threshold but enough reads done", () => {
		const state = freshState("ca-reads-done")
		state.consecutiveFixFailures = 3
		state.newFilesReadSinceLastFailure = 3
		const result = evaluateCausalAnalysisRequired(state, DEFAULT_FIX_LIFECYCLE_GATE_CONFIG)
		expect(result.shouldBlock).toBe(false)
		deleteCognitiveSession("ca-reads-done")
	})

	test("requires counterfactual step when failures >= 3", () => {
		const state = freshState("ca-counterfactual")
		state.consecutiveFixFailures = 3
		state.newFilesReadSinceLastFailure = 0
		const result = evaluateCausalAnalysisRequired(state, DEFAULT_FIX_LIFECYCLE_GATE_CONFIG)
		expect(result.shouldBlock).toBe(true)
		expect(result.requiredSteps).toContain("counterfactual")
		deleteCognitiveSession("ca-counterfactual")
	})

	test("respects configurable caTrigggerFailures", () => {
		const config = { ...DEFAULT_FIX_LIFECYCLE_GATE_CONFIG, caTrigggerFailures: 4 }
		const state = freshState("ca-config")
		state.consecutiveFixFailures = 3
		const result = evaluateCausalAnalysisRequired(state, config)
		expect(result.shouldBlock).toBe(false)
		deleteCognitiveSession("ca-config")
	})

	test("respects configurable caRequiredReadsBeforeRetry", () => {
		const config = { ...DEFAULT_FIX_LIFECYCLE_GATE_CONFIG, caRequiredReadsBeforeRetry: 1 }
		const state = freshState("ca-reads-config")
		state.consecutiveFixFailures = 2
		state.newFilesReadSinceLastFailure = 1
		const result = evaluateCausalAnalysisRequired(state, config)
		expect(result.shouldBlock).toBe(false)
		deleteCognitiveSession("ca-reads-config")
	})
})
