import { describe, expect, test } from "bun:test"
import { getCognitiveState, deleteCognitiveSession } from "../cognitive-governance-shared/state"
import { trackBuildResult, trackTestResult } from "./edit-tracker"

describe("edit-tracker", () => {
	test("marks build success from bun build bundled output", () => {
		const state = getCognitiveState("edit-tracker-build-success")
		trackBuildResult(state, "Bundled 1976 modules in 145ms")
		expect(state.lastBuildResult).toBe("success")
		deleteCognitiveSession("edit-tracker-build-success")
	})

	test("marks build success for clean tsc --noEmit run", () => {
		const state = getCognitiveState("edit-tracker-tsc-success")
		trackBuildResult(state, "$ tsc --noEmit")
		expect(state.lastBuildResult).toBe("success")
		deleteCognitiveSession("edit-tracker-tsc-success")
	})

	test("marks build fail from TS compiler error output", () => {
		const state = getCognitiveState("edit-tracker-build-fail")
		trackBuildResult(state, "error TS2307: Cannot find module 'bun:test'")
		expect(state.lastBuildResult).toBe("fail")
		deleteCognitiveSession("edit-tracker-build-fail")
	})

	test("marks test success from bun pass/fail summary", () => {
		const state = getCognitiveState("edit-tracker-test-success")
		trackTestResult(state, "66 pass\n0 fail")
		expect(state.lastTestResult).toBe("success")
		deleteCognitiveSession("edit-tracker-test-success")
	})

	test("marks test fail when fail count is non-zero", () => {
		const state = getCognitiveState("edit-tracker-test-fail")
		trackTestResult(state, "66 pass\n1 fail")
		expect(state.lastTestResult).toBe("fail")
		deleteCognitiveSession("edit-tracker-test-fail")
	})
})
