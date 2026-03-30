import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { formatGateInfoForNotification, getGateNotificationSuffix, readSessionGateInfo } from "./gate-info-reader"
import type { SessionGateInfo } from "./gate-info-reader"

describe("gate-info-reader", () => {
	let tempDir: string
	let originalCwd: () => string

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "gate-info-reader-test-"))
		originalCwd = process.cwd
		process.cwd = () => tempDir
	})

	afterEach(() => {
		process.cwd = originalCwd
		rmSync(tempDir, { recursive: true, force: true })
	})

	function writeGateFiles(sessionID: string, opts: {
		metadata?: Record<string, unknown>
		events?: unknown[]
		abortEvents?: unknown[]
	}): void {
		const dir = join(tempDir, ".sisyphus/gate-metadata", sessionID)
		mkdirSync(dir, { recursive: true })
		if (opts.metadata) {
			writeFileSync(join(dir, "gate-metadata.json"), JSON.stringify(opts.metadata))
		}
		if (opts.events) {
			writeFileSync(join(dir, "gate-events.json"), JSON.stringify(opts.events))
		}
		if (opts.abortEvents) {
			writeFileSync(join(dir, "tool-abort-events.json"), JSON.stringify(opts.abortEvents))
		}
	}

	describe("readSessionGateInfo", () => {
		test("returns empty info when no files exist", async () => {
			const info = await readSessionGateInfo("ses_nonexistent")

			expect(info.gateMetadata).toBeNull()
			expect(info.gateEvents).toEqual([])
			expect(info.toolAbortEvents).toEqual([])
		})

		test("reads gate metadata when file exists", async () => {
			writeGateFiles("ses_read_test", {
				metadata: {
					gateResponse: {
						gateId: "test-gate",
						severity: "hard_block",
						reason: "test reason",
						recoveryAction: "do something",
						blockCount: 3,
						escalationLevel: 2,
						correlationId: "corr-123",
						metadata: {},
					},
					timestamp: "2026-03-30T00:00:00.000Z",
					sessionId: "ses_read_test",
					totalBlockCount: 3,
				},
			})

			const info = await readSessionGateInfo("ses_read_test")

			expect(info.gateMetadata).not.toBeNull()
			expect(info.gateMetadata!.gateResponse.gateId).toBe("test-gate")
		})

		test("reads tool abort events when file exists", async () => {
			writeGateFiles("ses_abort_test", {
				abortEvents: [
					{ toolName: "write", reason: "tool execution aborted", timestamp: "2026-03-30T00:00:00.000Z", consecutiveCount: 1 },
					{ toolName: "write", reason: "tool execution aborted", timestamp: "2026-03-30T00:01:00.000Z", consecutiveCount: 2 },
				],
			})

			const info = await readSessionGateInfo("ses_abort_test")

			expect(info.toolAbortEvents).toHaveLength(2)
			expect(info.toolAbortEvents[1].consecutiveCount).toBe(2)
		})
	})

	describe("formatGateInfoForNotification", () => {
		test("returns empty string when no gate info", () => {
			const info: SessionGateInfo = { gateMetadata: null, gateEvents: [], toolAbortEvents: [] }

			expect(formatGateInfoForNotification(info)).toBe("")
		})

		test("formats gate metadata block", () => {
			const info: SessionGateInfo = {
				gateMetadata: {
					gateResponse: {
						gateId: "fix-lifecycle-gate:F3",
						severity: "hard_block" as const,
						reason: "Unverified Changes",
						recoveryAction: "Run lsp_diagnostics",
						blockCount: 3,
						escalationLevel: 2 as const,
						correlationId: "corr-fmt",
						metadata: {},
					},
					timestamp: "2026-03-30T00:00:00.000Z",
					sessionId: "ses_fmt",
					totalBlockCount: 3,
				},
				gateEvents: [],
				toolAbortEvents: [],
			}

			const result = formatGateInfoForNotification(info)

			expect(result).toContain("Gate Block Detected")
			expect(result).toContain("fix-lifecycle-gate:F3")
			expect(result).toContain("hard_block")
			expect(result).toContain("Block Count: 3")
		})

		test("formats tool abort events", () => {
			const info: SessionGateInfo = {
				gateMetadata: null,
				gateEvents: [],
				toolAbortEvents: [
					{ toolName: "write", reason: "aborted", timestamp: "2026-03-30T00:00:00.000Z", consecutiveCount: 2 },
				],
			}

			const result = formatGateInfoForNotification(info)

			expect(result).toContain("Tool Abort Events")
			expect(result).toContain("write")
			expect(result).toContain("consecutive: 2")
		})

		test("formats gate event count", () => {
			const info: SessionGateInfo = {
				gateMetadata: null,
				gateEvents: [
					{ sessionId: "ses_1", gateId: "g1", severity: "warning" as const, blockCount: 1, timestamp: "2026-03-30T00:00:00.000Z" },
					{ sessionId: "ses_1", gateId: "g2", severity: "soft_block" as const, blockCount: 2, timestamp: "2026-03-30T00:01:00.000Z" },
				],
				toolAbortEvents: [],
			}

			const result = formatGateInfoForNotification(info)

			expect(result).toContain("Gate Events:** 2 total")
		})
	})

	describe("getGateNotificationSuffix", () => {
		test("returns empty string when no gate data", async () => {
			const result = await getGateNotificationSuffix("ses_empty")

			expect(result).toBe("")
		})

		test("returns formatted info when gate metadata exists", async () => {
			writeGateFiles("ses_suffix_test", {
				metadata: {
					gateResponse: {
						gateId: "test-gate",
						severity: "hard_block",
						reason: "blocked",
						recoveryAction: "fix it",
						blockCount: 1,
						escalationLevel: 1,
						correlationId: "corr-suffix",
						metadata: {},
					},
					timestamp: "2026-03-30T00:00:00.000Z",
					sessionId: "ses_suffix_test",
					totalBlockCount: 1,
				},
			})

			const result = await getGateNotificationSuffix("ses_suffix_test")

			expect(result).toContain("Gate Block Detected")
		})
	})
})
