import { describe, expect, test } from "bun:test"
import { extractStructuralSignals, extractFilePath } from "./structural-signals"

describe("structural-signals", () => {
	describe("extractFilePath", () => {
		test("extracts filePath from args", () => {
			expect(extractFilePath("edit", { filePath: "/src/foo.ts" })).toBe("/src/foo.ts")
		})

		test("extracts file_path from args", () => {
			expect(extractFilePath("read", { file_path: "/src/bar.ts" })).toBe("/src/bar.ts")
		})

		test("returns undefined for bash", () => {
			expect(extractFilePath("bash", { command: "ls" })).toBeUndefined()
		})

		test("extracts first file path from apply_patch patchText", () => {
			const patchText = [
				"*** Begin Patch",
				"*** Update File: src/foo.ts",
				"@@",
				"-old",
				"+new",
				"*** End Patch",
			].join("\n")
			expect(extractFilePath("apply_patch", { patchText })).toBe("src/foo.ts")
		})
	})

	describe("shell_command signals", () => {
		test("extracts exit code", () => {
			const signals = extractStructuralSignals("shell_command", "exit code: 1", {})
			expect(signals.exitCode).toBe(1)
		})

		test("extracts exit code 0 from success message", () => {
			const signals = extractStructuralSignals("shell_command", "Process completed successfully", {})
			expect(signals.exitCode).toBe(0)
		})
	})

	describe("lsp_structured signals", () => {
		test("extracts diagnostic count", () => {
			const signals = extractStructuralSignals("lsp_structured", "Found 3 errors in file", {})
			expect(signals.diagnosticCount).toBe(3)
		})

		test("extracts line number", () => {
			const signals = extractStructuralSignals("lsp_structured", "error at line 42", {})
			expect(signals.lineNumber).toBe(42)
		})

		test("zero diagnostics", () => {
			const signals = extractStructuralSignals("lsp_structured", "No diagnostics found", {})
			expect(signals.diagnosticCount).toBe(0)
		})
	})

	describe("search_result signals", () => {
		test("extracts match count", () => {
			const signals = extractStructuralSignals("search_result", "Found 5 matches in 3 files", {})
			expect(signals.matchCount).toBe(5)
		})

		test("zero matches", () => {
			const signals = extractStructuralSignals("search_result", "No matches found", {})
			expect(signals.matchCount).toBe(0)
		})
	})

	describe("file_modification signals (II-2)", () => {
		test("detects successful edit", () => {
			const signals = extractStructuralSignals("file_modification", "Edit applied successfully.", {})
			expect(signals.editSuccess).toBe(true)
		})

		test("detects successful write", () => {
			const signals = extractStructuralSignals("file_modification", "Wrote file successfully.", {})
			expect(signals.editSuccess).toBe(true)
		})

		test("detects failed edit — oldString not found", () => {
			const signals = extractStructuralSignals("file_modification", 'oldString not found in content', {})
			expect(signals.editSuccess).toBe(false)
		})

		test("detects failed edit — multiple matches", () => {
			const signals = extractStructuralSignals("file_modification", "Found multiple matches for oldString", {})
			expect(signals.editSuccess).toBe(false)
		})

		test("undefined for ambiguous output", () => {
			const signals = extractStructuralSignals("file_modification", "some other output", {})
			expect(signals.editSuccess).toBeUndefined()
		})
	})

	describe("agent_output signals (II-2)", () => {
		test("detects error status", () => {
			const output = '| Status | **error** |\n> **Failed**: The task encountered an error.'
			const signals = extractStructuralSignals("agent_output", output, {})
			expect(signals.taskStatus).toBe("error")
		})

		test("detects [task ERROR]", () => {
			const signals = extractStructuralSignals("agent_output", "[task ERROR] Fix and retry.", {})
			expect(signals.taskStatus).toBe("error")
		})

		test("detects completed status", () => {
			const signals = extractStructuralSignals("agent_output", "Task completed successfully.", {})
			expect(signals.taskStatus).toBe("completed")
		})

		test("detects pending status", () => {
			const signals = extractStructuralSignals("agent_output", "2 tasks still in progress.", {})
			expect(signals.taskStatus).toBe("pending")
		})

		test("undefined for ambiguous agent output", () => {
			const signals = extractStructuralSignals("agent_output", "Here is the analysis result...", {})
			expect(signals.taskStatus).toBeUndefined()
		})
	})
})
