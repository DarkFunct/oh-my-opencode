import { describe, expect, test } from "bun:test"
import { getCognitiveState, deleteCognitiveSession } from "../cognitive-governance-shared/state"
import { recordInjection, checkInjectionResolutions, computeEffectiveness } from "./injection-tracker"

describe("injection-tracker (V-1)", () => {
	test("recordInjection adds event to history", () => {
		const state = getCognitiveState("test-inject-1")
		state.roundCounter = 3
		recordInjection(state, "F1")

		expect(state.injectionHistory.length).toBe(1)
		expect(state.injectionHistory[0].failureId).toBe("F1")
		expect(state.injectionHistory[0].round).toBe(3)
		expect(state.injectionHistory[0].resolved).toBe(false)
		deleteCognitiveSession("test-inject-1")
	})

	test("F1 resolves when readCount > 0 and errorSourceTraced", () => {
		const state = getCognitiveState("test-inject-f1")
		state.roundCounter = 0
		recordInjection(state, "F1")

		state.roundCounter = 2
		state.readCount = 3
		state.errorSourceTraced = true
		checkInjectionResolutions(state)

		expect(state.injectionHistory[0].resolved).toBe(true)
		expect(state.injectionHistory[0].resolvedRound).toBe(2)
		deleteCognitiveSession("test-inject-f1")
	})

	test("F3 resolves when editsSinceLastVerification resets to 0", () => {
		const state = getCognitiveState("test-inject-f3")
		state.roundCounter = 1
		state.editsSinceLastVerification = 5
		recordInjection(state, "F3")

		state.roundCounter = 3
		state.editsSinceLastVerification = 0
		checkInjectionResolutions(state)

		expect(state.injectionHistory[0].resolved).toBe(true)
		deleteCognitiveSession("test-inject-f3")
	})

	test("F5 resolves when newFilesReadSinceLastFailure > 0", () => {
		const state = getCognitiveState("test-inject-f5")
		state.roundCounter = 0
		recordInjection(state, "F5")

		state.roundCounter = 1
		state.newFilesReadSinceLastFailure = 2
		checkInjectionResolutions(state)

		expect(state.injectionHistory[0].resolved).toBe(true)
		deleteCognitiveSession("test-inject-f5")
	})

	test("F2/F4/cognitive_directive never resolve structurally", () => {
		const state = getCognitiveState("test-inject-no-resolve")
		state.roundCounter = 0
		recordInjection(state, "F2")
		recordInjection(state, "F4")
		recordInjection(state, "cognitive_directive")

		state.roundCounter = 3
		state.readCount = 10
		state.errorSourceTraced = true
		checkInjectionResolutions(state)

		expect(state.injectionHistory.every((e) => !e.resolved)).toBe(true)
		deleteCognitiveSession("test-inject-no-resolve")
	})

	test("events outside resolution window are skipped", () => {
		const state = getCognitiveState("test-inject-window")
		state.roundCounter = 0
		recordInjection(state, "F1")

		state.roundCounter = 10
		state.readCount = 5
		state.errorSourceTraced = true
		checkInjectionResolutions(state)

		expect(state.injectionHistory[0].resolved).toBe(false)
		deleteCognitiveSession("test-inject-window")
	})

	test("computeEffectiveness calculates rates correctly", () => {
		const state = getCognitiveState("test-inject-stats")

		state.roundCounter = 0
		recordInjection(state, "F1")
		recordInjection(state, "F3")
		recordInjection(state, "F2")

		state.roundCounter = 2
		state.readCount = 1
		state.errorSourceTraced = true
		state.editsSinceLastVerification = 0
		checkInjectionResolutions(state)

		const stats = computeEffectiveness(state)
		expect(stats.total).toBe(3)
		expect(stats.resolved).toBe(2)
		expect(stats.unresolved).toBe(1)
		expect(stats.expired).toBe(0)
		expect(stats.resolutionRate).toBeCloseTo(2 / 3)
		deleteCognitiveSession("test-inject-stats")
	})

	test("computeEffectiveness counts expired events", () => {
		const state = getCognitiveState("test-inject-expired")
		state.roundCounter = 0
		recordInjection(state, "F2")

		state.roundCounter = 10
		const stats = computeEffectiveness(state)
		expect(stats.expired).toBe(1)
		expect(stats.unresolved).toBe(0)
		deleteCognitiveSession("test-inject-expired")
	})

	test("empty history returns zero stats", () => {
		const state = getCognitiveState("test-inject-empty")
		const stats = computeEffectiveness(state)
		expect(stats.total).toBe(0)
		expect(stats.resolutionRate).toBe(0)
		deleteCognitiveSession("test-inject-empty")
	})
})
