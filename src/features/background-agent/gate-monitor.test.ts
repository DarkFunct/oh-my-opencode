import { describe, expect, test } from "bun:test"
import type { SubAgentGateEvent } from "@gaia/omo-hooks"
import { shouldAbortForGateBlock } from "./gate-monitor"

function makeEvent(severity: string, blockCount: number, gateId = "fix-lifecycle-gate:F3"): SubAgentGateEvent {
	return {
		sessionId: "ses_test",
		gateId,
		severity: severity as SubAgentGateEvent["severity"],
		blockCount,
		timestamp: new Date().toISOString(),
	}
}

describe("gate-monitor: shouldAbortForGateBlock", () => {
	test("returns not triggered for empty events", () => {
		const result = shouldAbortForGateBlock([], 3)
		expect(result.triggered).toBe(false)
		expect(result.gateInfo).toBeUndefined()
	})

	test("returns not triggered when below threshold", () => {
		const events = [
			makeEvent("hard_block", 3),
			makeEvent("hard_block", 4),
		]
		const result = shouldAbortForGateBlock(events, 3)
		expect(result.triggered).toBe(false)
	})

	test("returns triggered when consecutive hard_block meets threshold", () => {
		const events = [
			makeEvent("hard_block", 3),
			makeEvent("hard_block", 4),
			makeEvent("hard_block", 5),
		]
		const result = shouldAbortForGateBlock(events, 3)
		expect(result.triggered).toBe(true)
		expect(result.gateInfo).toBeDefined()
		expect(result.gateInfo).toContain("hard_block")
	})

	test("returns triggered when abort events reach threshold", () => {
		const events = [
			makeEvent("abort", 5),
			makeEvent("abort", 6),
		]
		const result = shouldAbortForGateBlock(events, 2)
		expect(result.triggered).toBe(true)
	})

	test("counts only trailing consecutive hard_block/abort events", () => {
		const events = [
			makeEvent("hard_block", 3),
			makeEvent("hard_block", 4),
			makeEvent("warning", 1),
			makeEvent("hard_block", 5),
		]
		const result = shouldAbortForGateBlock(events, 3)
		expect(result.triggered).toBe(false)
	})

	test("mixed hard_block and abort count together", () => {
		const events = [
			makeEvent("hard_block", 3),
			makeEvent("abort", 5),
			makeEvent("hard_block", 6),
		]
		const result = shouldAbortForGateBlock(events, 3)
		expect(result.triggered).toBe(true)
	})

	test("warning events break the consecutive chain", () => {
		const events = [
			makeEvent("hard_block", 3),
			makeEvent("warning", 1),
			makeEvent("hard_block", 4),
			makeEvent("hard_block", 5),
		]
		const result = shouldAbortForGateBlock(events, 3)
		expect(result.triggered).toBe(false)
	})

	test("soft_block events break the consecutive chain", () => {
		const events = [
			makeEvent("hard_block", 3),
			makeEvent("soft_block", 2),
			makeEvent("hard_block", 4),
			makeEvent("hard_block", 5),
		]
		const result = shouldAbortForGateBlock(events, 3)
		expect(result.triggered).toBe(false)
	})

	test("gateInfo includes last event details", () => {
		const events = [
			makeEvent("hard_block", 3, "fix-lifecycle-gate:F3"),
			makeEvent("hard_block", 4, "fix-lifecycle-gate:F3"),
			makeEvent("abort", 5, "fix-lifecycle-gate:F3"),
		]
		const result = shouldAbortForGateBlock(events, 3)
		expect(result.triggered).toBe(true)
		expect(result.gateInfo).toContain("fix-lifecycle-gate:F3")
		expect(result.gateInfo).toContain("3")
	})
})
