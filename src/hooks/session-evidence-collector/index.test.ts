import { describe, expect, test } from "bun:test"
import { createSessionEvidenceCollectorHook } from "./index"
import { getCognitiveState, deleteCognitiveSession } from "../cognitive-governance-shared/state"

function createHook() {
	return createSessionEvidenceCollectorHook({} as never)
}

describe("session-evidence-collector hook", () => {
	test("resets verification backlog only when diagnostics are clean", async () => {
		const sessionID = "sec-hook-diagnostics"
		const state = getCognitiveState(sessionID)
		state.editsSinceLastVerification = 2

		const hook = createHook()
		const before = hook["tool.execute.before"]
		const after = hook["tool.execute.after"]
		if (!before || !after) throw new Error("session-evidence-collector hook handlers missing")

		await before({ tool: "lsp_diagnostics", sessionID, callID: "c1" }, { args: { filePath: "src/foo.ts" } })
		await after(
			{ tool: "lsp_diagnostics", sessionID, callID: "c1" },
			{ title: "diag", output: "Files with errors: 1", metadata: {} },
		)
		expect(state.editsSinceLastVerification).toBe(2)

		await before({ tool: "lsp_diagnostics", sessionID, callID: "c2" }, { args: { filePath: "src/foo.ts" } })
		await after(
			{ tool: "lsp_diagnostics", sessionID, callID: "c2" },
			{ title: "diag", output: "No diagnostics found", metadata: {} },
		)
		expect(state.editsSinceLastVerification).toBe(0)

		deleteCognitiveSession(sessionID)
	})

	test("does not clear pending edits from stale historical success", async () => {
		const sessionID = "sec-hook-stale-success"
		const state = getCognitiveState(sessionID)
		state.editsSinceLastVerification = 1
		state.lastBuildResult = "success"

		const hook = createHook()
		const after = hook["tool.execute.after"]
		if (!after) throw new Error("tool.execute.after missing")

		await after(
			{ tool: "bash", sessionID, callID: "c3" },
			{ title: "bash", output: "some unrelated command output", metadata: {} },
		)

		expect(state.editsSinceLastVerification).toBe(1)
		deleteCognitiveSession(sessionID)
	})

	test("increments backlog only for known verifiable write paths", async () => {
		const sessionID = "sec-hook-verifiable"
		const state = getCognitiveState(sessionID)

		const hook = createHook()
		const before = hook["tool.execute.before"]
		if (!before) throw new Error("tool.execute.before missing")

		const docPatch = [
			"*** Begin Patch",
			"*** Update File: _meta/knowledge/lessons-learned.md",
			"@@",
			"-old",
			"+new",
			"*** End Patch",
		].join("\n")
		await before({ tool: "apply_patch", sessionID, callID: "c4" }, { args: { patchText: docPatch } })
		expect(state.editsSinceLastVerification).toBe(0)

		const codePatch = [
			"*** Begin Patch",
			"*** Update File: src/foo.ts",
			"@@",
			"-old",
			"+new",
			"*** End Patch",
		].join("\n")
		await before({ tool: "apply_patch", sessionID, callID: "c5" }, { args: { patchText: codePatch } })
		expect(state.editsSinceLastVerification).toBe(1)

		await before({ tool: "write", sessionID, callID: "c6" }, { args: { content: "hello" } })
		expect(state.editsSinceLastVerification).toBe(1)

		deleteCognitiveSession(sessionID)
	})
})
