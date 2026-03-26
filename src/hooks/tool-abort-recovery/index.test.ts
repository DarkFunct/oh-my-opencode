import { describe, expect, test } from "bun:test"
import { createToolAbortRecoveryHook } from "./index"

type Hook = ReturnType<typeof createToolAbortRecoveryHook>

function createHook(): Hook {
	return createToolAbortRecoveryHook({ directory: "/tmp" } as never)
}

function makeInput(tool = "bash") {
	return { tool, sessionID: "ses_test", callID: "call_1" }
}

function makeOutput(text: string) {
	return { title: "", output: text, metadata: {} }
}

describe("tool-abort-recovery", () => {
	test("appends continuation message when abort detected", async () => {
		const hook = createHook()
		const output = makeOutput("Error: tool execution aborted by user")

		await hook["tool.execute.after"](makeInput(), output)

		expect(output.output).toContain("tool execution aborted")
		expect(output.output).toContain("[SYSTEM]")
		expect(output.output).toContain("工具执行被中断")
	})

	test("detects 'execution was aborted'", async () => {
		const hook = createHook()
		const output = makeOutput("The execution was aborted due to timeout")

		await hook["tool.execute.after"](makeInput(), output)

		expect(output.output).toContain("[SYSTEM]")
	})

	test("detects 'timed out'", async () => {
		const hook = createHook()
		const output = makeOutput("Command timed out after 120000ms")

		await hook["tool.execute.after"](makeInput(), output)

		expect(output.output).toContain("[SYSTEM]")
	})

	test("detects 'operation was aborted'", async () => {
		const hook = createHook()
		const output = makeOutput("The operation was aborted")

		await hook["tool.execute.after"](makeInput(), output)

		expect(output.output).toContain("[SYSTEM]")
	})

	test("detects case-insensitive abort text", async () => {
		const hook = createHook()
		const output = makeOutput("TOOL EXECUTION ABORTED")

		await hook["tool.execute.after"](makeInput(), output)

		expect(output.output).toContain("[SYSTEM]")
	})

	test("does not modify normal output", async () => {
		const hook = createHook()
		const originalOutput = "Build succeeded. 0 errors, 0 warnings."
		const output = makeOutput(originalOutput)

		await hook["tool.execute.after"](makeInput(), output)

		expect(output.output).toBe(originalOutput)
	})

	test("does not modify empty output", async () => {
		const hook = createHook()
		const output = makeOutput("")

		await hook["tool.execute.after"](makeInput(), output)

		expect(output.output).toBe("")
	})

	test("handles undefined output gracefully", async () => {
		const hook = createHook()

		await hook["tool.execute.after"](makeInput(), undefined as never)
	})

	test("works with any tool type", async () => {
		const hook = createHook()
		const output = makeOutput("tool execution aborted")

		await hook["tool.execute.after"](makeInput("edit"), output)

		expect(output.output).toContain("[SYSTEM]")
	})

	test("only exposes tool.execute.after handler", () => {
		const hook = createHook()

		expect(hook["tool.execute.after"]).toBeDefined()
		expect(Object.keys(hook)).toEqual(["tool.execute.after"])
	})
})
