import { describe, expect, test, beforeEach } from "bun:test"
import { trackBashResult, createProtectionState } from "./capture-detector"
import type { ProtectionState } from "./types"

describe("createProtectionState", () => {
	test("returns fresh state with empty values", () => {
		const state = createProtectionState()
		expect(state.lastBashErrors).toEqual([])
		expect(state.knowledgeCaptureNeeded).toBe(false)
		expect(state.captureContext).toBeNull()
	})
})

describe("trackBashResult", () => {
	let state: ProtectionState

	beforeEach(() => {
		state = createProtectionState()
	})

	test("records error when exitCode is non-zero via metadata", () => {
		trackBashResult(state, "npm install", "", { exitCode: 1 })
		expect(state.lastBashErrors).toHaveLength(1)
		expect(state.lastBashErrors[0].command).toBe("npm install")
		expect(state.lastBashErrors[0].exitCode).toBe(1)
		expect(state.knowledgeCaptureNeeded).toBe(false)
	})

	test("records error when exitCode is parsed from output", () => {
		trackBashResult(state, "npm install", "exit code: 1", {})
		expect(state.lastBashErrors).toHaveLength(1)
		expect(state.lastBashErrors[0].exitCode).toBe(1)
	})

	test("parses 'exited with code N' format", () => {
		trackBashResult(state, "make build", "Process exited with code 2", {})
		expect(state.lastBashErrors).toHaveLength(1)
		expect(state.lastBashErrors[0].exitCode).toBe(2)
	})

	test("ignores output with no exit code info", () => {
		trackBashResult(state, "echo hello", "hello world", {})
		expect(state.lastBashErrors).toHaveLength(0)
		expect(state.knowledgeCaptureNeeded).toBe(false)
	})

	test("triggers capture on error → success sequence", () => {
		trackBashResult(state, "docker compose up", "exit code: 1", {})
		expect(state.lastBashErrors).toHaveLength(1)

		trackBashResult(state, "docker-compose up", "", { exitCode: 0 })
		expect(state.knowledgeCaptureNeeded).toBe(true)
		expect(state.captureContext).toContain("docker compose up")
		expect(state.captureContext).toContain("docker-compose up")
		expect(state.lastBashErrors).toHaveLength(0)
	})

	test("does not trigger capture on success without prior error", () => {
		trackBashResult(state, "ls -la", "", { exitCode: 0 })
		expect(state.knowledgeCaptureNeeded).toBe(false)
		expect(state.captureContext).toBeNull()
	})

	test("accumulates multiple errors before success triggers capture", () => {
		trackBashResult(state, "cmd1", "exit code: 1", {})
		trackBashResult(state, "cmd2", "exit code: 127", {})
		expect(state.lastBashErrors).toHaveLength(2)

		trackBashResult(state, "cmd3-success", "", { exitCode: 0 })
		expect(state.knowledgeCaptureNeeded).toBe(true)
		expect(state.captureContext).toContain("cmd2")
		expect(state.captureContext).toContain("cmd3-success")
	})

	test("caps error history at MAX_ERROR_HISTORY (5)", () => {
		for (let i = 0; i < 7; i++) {
			trackBashResult(state, `cmd-${i}`, `exit code: ${i + 1}`, {})
		}
		expect(state.lastBashErrors).toHaveLength(5)
		expect(state.lastBashErrors[0].command).toBe("cmd-2")
	})

	test("prunes errors older than 5 minutes", () => {
		const oldTimestamp = Date.now() - 6 * 60 * 1000
		state.lastBashErrors = [{
			command: "old-cmd",
			exitCode: 1,
			timestamp: oldTimestamp,
		}]

		trackBashResult(state, "new-cmd", "", { exitCode: 0 })
		expect(state.knowledgeCaptureNeeded).toBe(false)
	})

	test("metadata.exitCode takes priority over output parsing", () => {
		trackBashResult(state, "cmd", "exit code: 99", { exitCode: 0 })
		expect(state.lastBashErrors).toHaveLength(0)
	})

	test("clears error history after capture trigger", () => {
		trackBashResult(state, "fail-cmd", "exit code: 1", {})
		trackBashResult(state, "success-cmd", "", { exitCode: 0 })

		expect(state.lastBashErrors).toHaveLength(0)
		expect(state.knowledgeCaptureNeeded).toBe(true)

		state.knowledgeCaptureNeeded = false
		state.captureContext = null

		trackBashResult(state, "another-success", "", { exitCode: 0 })
		expect(state.knowledgeCaptureNeeded).toBe(false)
	})
})
