import { describe, expect, test } from "bun:test"
import * as fs from "fs"
import { getLogFilePath } from "../../shared/logger"
import { buildAbortExplanation, executeSessionAbort, shouldAbortSession } from "./abort-handler"

describe("shouldAbortSession", () => {
	test("returns true for abort severity", () => {
		expect(shouldAbortSession("abort")).toBe(true)
	})

	test("returns false for warning severity", () => {
		expect(shouldAbortSession("warning")).toBe(false)
	})

	test("returns false for soft_block severity", () => {
		expect(shouldAbortSession("soft_block")).toBe(false)
	})

	test("returns false for hard_block severity", () => {
		expect(shouldAbortSession("hard_block")).toBe(false)
	})
})

describe("buildAbortExplanation", () => {
	test("includes gate id, response count, block count, reason, and new-session instruction", () => {
		const explanation = buildAbortExplanation({
			sessionID: "ses_abort_case",
			gateId: "methodology-coverage",
			blockCount: 3,
			responseCount: 5,
			reason: "methodology coverage missing",
		})

		expect(explanation).toContain("门控 methodology-coverage 经过 5 次响应尝试后仍未解除。")
		expect(explanation).toContain("累计阻断: 3 次")
		expect(explanation).toContain("终止原因: methodology coverage missing")
		expect(explanation).toContain("如需继续此任务，请在新会话中先完成门控要求的认知操作。")
	})
})

describe("executeSessionAbort", () => {
	test("calls session.abort", async () => {
		const calls: Array<{ path: { id: string } }> = []
		const ctx = {
			client: {
				session: {
					abort: async (params: { path: { id: string } }) => {
						calls.push(params)
					},
				},
			},
		}

		await executeSessionAbort(ctx, "ses_test_123")
		expect(calls).toEqual([{ path: { id: "ses_test_123" } }])
	})

	test("handles session.abort failure gracefully", async () => {
		let callCount = 0
		const ctx = {
			client: {
				session: {
					abort: async () => {
						callCount += 1
						throw new Error("abort failed")
					},
				},
			},
		}

		await executeSessionAbort(ctx, "ses_fail")
		expect(callCount).toBe(1)
	})

	test("logs abort explanation when abortContext is provided", async () => {
		const logPath = getLogFilePath()
		if (fs.existsSync(logPath)) {
			fs.unlinkSync(logPath)
		}

		const uniqueReason = `abort-test-reason-${Date.now()}`
		const ctx = {
			client: {
				session: {
					abort: async () => {
						return null
					},
				},
			},
		}

		await executeSessionAbort(ctx, "ses_log_case", {
			sessionID: "ses_log_case",
			gateId: "methodology-coverage",
			blockCount: 4,
			responseCount: 6,
			reason: uniqueReason,
		})

		await new Promise(resolve => setTimeout(resolve, 700))
		const logContent = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8") : ""

		expect(logContent).toContain("[fix-lifecycle-gate] Abort explanation")
		expect(logContent).toContain(uniqueReason)
		expect(logContent).toContain("methodology-coverage")
	})
})
