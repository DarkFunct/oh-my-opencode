import { describe, expect, test } from "bun:test"
import type { DeliveryEvidence } from "../cognitive-governance-shared/types"
import { evaluateDeliveryReadiness, type DeliveryGateResult } from "./delivery-gate"
import { DEFAULT_FIX_LIFECYCLE_GATE_CONFIG } from "./config"

function makeEvidence(overrides: Partial<DeliveryEvidence> = {}): DeliveryEvidence {
	return {
		lastBuildTimestamp: null,
		lastBuildCommand: null,
		buildExitCode: null,
		lastCodeChangeTimestamp: null,
		codeChangesSinceBuild: 0,
		lastTestTimestamp: null,
		lastTestResult: "unknown",
		testsSinceCodeChange: false,
		...overrides,
	}
}

describe("delivery-gate", () => {
	test("returns no block when no code changes since build", () => {
		const evidence = makeEvidence({ codeChangesSinceBuild: 0 })
		const result = evaluateDeliveryReadiness(evidence, 0, DEFAULT_FIX_LIFECYCLE_GATE_CONFIG)
		expect(result.shouldBlock).toBe(false)
		expect(result.reason).toBeNull()
	})

	test("warns on first stale build occurrence", () => {
		const evidence = makeEvidence({ codeChangesSinceBuild: 3 })
		const result = evaluateDeliveryReadiness(evidence, 0, DEFAULT_FIX_LIFECYCLE_GATE_CONFIG)
		expect(result.shouldBlock).toBe(false)
		expect(result.reason).toBe("build_stale")
	})

	test("blocks after warning threshold exceeded", () => {
		const config = { ...DEFAULT_FIX_LIFECYCLE_GATE_CONFIG, dvWarningThreshold: 2 }
		const evidence = makeEvidence({ codeChangesSinceBuild: 5 })
		const result = evaluateDeliveryReadiness(evidence, 3, config)
		expect(result.shouldBlock).toBe(true)
		expect(result.reason).toBe("build_stale")
	})

	test("blocks immediately on failed build exit code", () => {
		const evidence = makeEvidence({ buildExitCode: 1, codeChangesSinceBuild: 1 })
		const result = evaluateDeliveryReadiness(evidence, 0, DEFAULT_FIX_LIFECYCLE_GATE_CONFIG)
		expect(result.shouldBlock).toBe(true)
		expect(result.reason).toBe("build_failed")
	})

	test("blocks immediately on failed test result", () => {
		const evidence = makeEvidence({
			codeChangesSinceBuild: 1,
			lastTestResult: "fail",
		})
		const result = evaluateDeliveryReadiness(evidence, 0, DEFAULT_FIX_LIFECYCLE_GATE_CONFIG)
		expect(result.shouldBlock).toBe(true)
		expect(result.reason).toBe("tests_failed")
	})

	test("does not block when build exit code is 0", () => {
		const evidence = makeEvidence({ buildExitCode: 0, codeChangesSinceBuild: 0 })
		const result = evaluateDeliveryReadiness(evidence, 0, DEFAULT_FIX_LIFECYCLE_GATE_CONFIG)
		expect(result.shouldBlock).toBe(false)
	})

	test("uses dvWarningThreshold from config", () => {
		const config = { ...DEFAULT_FIX_LIFECYCLE_GATE_CONFIG, dvWarningThreshold: 1 }
		const evidence = makeEvidence({ codeChangesSinceBuild: 2 })
		const result = evaluateDeliveryReadiness(evidence, 2, config)
		expect(result.shouldBlock).toBe(true)
	})
})
