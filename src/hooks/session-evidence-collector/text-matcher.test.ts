import { describe, expect, test } from "bun:test"
import { matchTextSignals } from "./text-matcher"
import type { StructuralSignals } from "../cognitive-governance-shared/types"

const noSignals: StructuralSignals = {}

describe("text-matcher matchTextSignals", () => {
	describe("agent_output error detection (II-1)", () => {
		test("detects task status error from background_output", () => {
			const output = '| Status | **error** |\n> **Failed**: The task encountered an error.'
			const results = matchTextSignals("agent_output", output, noSignals)
			expect(results.length).toBeGreaterThanOrEqual(1)
			expect(results.some((r) => r.classification === "error")).toBe(true)
		})

		test("detects [task ERROR] pattern", () => {
			const output = "[task ERROR] Fix the error and retry with correct parameters."
			const results = matchTextSignals("agent_output", output, noSignals)
			expect(results.some((r) => r.classification === "error")).toBe(true)
		})

		test("detects Failed/timed out as warning", () => {
			const output = "Background task timed out after 30 minutes."
			const results = matchTextSignals("agent_output", output, noSignals)
			expect(results.some((r) => r.classification === "warning")).toBe(true)
		})

		test("Failed negation — ignores 'tests failed' in agent output", () => {
			const output = "4375 pass\n18 fail\nRan 4393 tests"
			const results = matchTextSignals("agent_output", output, noSignals)
			const warnings = results.filter((r) => r.classification === "warning")
			expect(warnings.length).toBe(0)
		})

		test("no false positives on successful agent output", () => {
			const output = "Task completed successfully. All 40 tests passed."
			const results = matchTextSignals("agent_output", output, noSignals)
			expect(results.length).toBe(0)
		})
	})

	describe("existing rules still work", () => {
		test("shell_command error detection", () => {
			const results = matchTextSignals("shell_command", "command not found: foo", noSignals)
			expect(results.some((r) => r.classification === "error")).toBe(true)
		})

		test("file_modification error detection", () => {
			const results = matchTextSignals("file_modification", "oldString not found in content", noSignals)
			expect(results.some((r) => r.classification === "error")).toBe(true)
		})

		test("NEVER_ERROR_SOURCES returns empty", () => {
			expect(matchTextSignals("search_result", "error TS1234:", noSignals)).toEqual([])
			expect(matchTextSignals("file_content", "fatal: crash", noSignals)).toEqual([])
			expect(matchTextSignals("web_content", "error occurred", noSignals)).toEqual([])
			expect(matchTextSignals("user_message", "something failed", noSignals)).toEqual([])
		})

		test("unknown source returns empty", () => {
			expect(matchTextSignals("unknown", "error everywhere", noSignals)).toEqual([])
		})
	})
})
