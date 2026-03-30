import { describe, expect, test, mock } from "bun:test"
import { DEFAULT_GATE_RESPONSE_CONFIG } from "@gaia/omo-hooks"

describe("abort-handler", () => {
	const mockAbort = mock(() => Promise.resolve())
	const mockCtx = {
		client: {
			session: {
				abort: mockAbort,
			},
		},
	}

	function resetMocks() {
		mockAbort.mockClear()
	}

	describe("shouldAbortSession", () => {
		const { shouldAbortSession } = require("./abort-handler")

		test("returns false when severity is not abort", () => {
			expect(shouldAbortSession("warning")).toBe(false)
			expect(shouldAbortSession("soft_block")).toBe(false)
			expect(shouldAbortSession("hard_block")).toBe(false)
		})

		test("returns true when severity is abort", () => {
			expect(shouldAbortSession("abort")).toBe(true)
		})
	})

	describe("executeSessionAbort", () => {
		const { executeSessionAbort } = require("./abort-handler")

		test("calls ctx.client.session.abort with correct sessionID", async () => {
			resetMocks()
			await executeSessionAbort(mockCtx, "ses_test_123")
			expect(mockAbort).toHaveBeenCalledTimes(1)
			expect(mockAbort).toHaveBeenCalledWith({ path: { id: "ses_test_123" } })
		})

		test("does not throw when abort rejects", async () => {
			resetMocks()
			mockAbort.mockImplementationOnce(() => Promise.reject(new Error("abort failed")))
			await executeSessionAbort(mockCtx, "ses_fail")
			expect(mockAbort).toHaveBeenCalledTimes(1)
		})

		test("does not throw when abort throws synchronously", async () => {
			resetMocks()
			mockAbort.mockImplementationOnce(() => { throw new Error("sync fail") })
			await executeSessionAbort(mockCtx, "ses_sync_fail")
			expect(mockAbort).toHaveBeenCalledTimes(1)
		})
	})

	describe("escalation to abort threshold", () => {
		const { shouldAbortSession } = require("./abort-handler")
		const { escalate } = require("@gaia/omo-hooks")

		test("escalate returns abort at default threshold (5)", () => {
			const severity = escalate(5, DEFAULT_GATE_RESPONSE_CONFIG)
			expect(severity).toBe("abort")
			expect(shouldAbortSession(severity)).toBe(true)
		})

		test("escalate returns hard_block below abort threshold", () => {
			const severity = escalate(4, DEFAULT_GATE_RESPONSE_CONFIG)
			expect(severity).toBe("hard_block")
			expect(shouldAbortSession(severity)).toBe(false)
		})

		test("escalate returns abort above threshold", () => {
			const severity = escalate(10, DEFAULT_GATE_RESPONSE_CONFIG)
			expect(severity).toBe("abort")
			expect(shouldAbortSession(severity)).toBe(true)
		})

		test("custom abort threshold is respected", () => {
			const customConfig = { ...DEFAULT_GATE_RESPONSE_CONFIG, abortThreshold: 3 }
			expect(shouldAbortSession(escalate(3, customConfig))).toBe(true)
			expect(shouldAbortSession(escalate(2, customConfig))).toBe(false)
		})
	})
})
