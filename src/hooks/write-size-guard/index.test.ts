import { describe, expect, test } from "bun:test"
import { createWriteSizeGuardHook } from "./index"

type Hook = ReturnType<typeof createWriteSizeGuardHook>

function createHook(overrides?: { maxLines?: number; enabled?: boolean }): Hook {
	return createWriteSizeGuardHook({ directory: "/tmp" } as never, overrides)
}

function makeInput(tool = "write", sessionID = "ses_test") {
	return { tool, sessionID, callID: "call_1" }
}

function makeOutput(content: string) {
	return { args: { filePath: "/tmp/test.ts", content } as Record<string, unknown> }
}

function lines(n: number): string {
	return Array.from({ length: n }, (_, i) => `line ${i + 1}`).join("\n")
}

describe("write-size-guard", () => {
	test("allows write within default limit", async () => {
		const hook = createHook()
		const output = makeOutput(lines(100))

		await hook["tool.execute.before"](makeInput(), output)

		expect(output.args.content).toBeDefined()
	})

	test("allows write at exactly max lines", async () => {
		const hook = createHook()
		const output = makeOutput(lines(200))

		await hook["tool.execute.before"](makeInput(), output)

		expect(output.args.content).toBeDefined()
	})

	test("blocks write exceeding default limit", async () => {
		const hook = createHook()
		const output = makeOutput(lines(201))

		await expect(
			hook["tool.execute.before"](makeInput(), output),
		).rejects.toThrow("Write Size Guard")
	})

	test("block message includes line count and limit", async () => {
		const hook = createHook()
		const output = makeOutput(lines(250))

		await expect(
			hook["tool.execute.before"](makeInput(), output),
		).rejects.toThrow("250")
	})

	test("respects custom maxLines config", async () => {
		const hook = createHook({ maxLines: 50 })
		const output = makeOutput(lines(51))

		await expect(
			hook["tool.execute.before"](makeInput(), output),
		).rejects.toThrow("Write Size Guard")
	})

	test("allows write when custom maxLines is higher", async () => {
		const hook = createHook({ maxLines: 500 })
		const output = makeOutput(lines(400))

		await hook["tool.execute.before"](makeInput(), output)

		expect(output.args.content).toBeDefined()
	})

	test("does nothing when disabled", async () => {
		const hook = createHook({ enabled: false })
		const output = makeOutput(lines(999))

		await hook["tool.execute.before"](makeInput(), output)

		expect(output.args.content).toBeDefined()
	})

	test("ignores non-write tools", async () => {
		const hook = createHook()
		const output = makeOutput(lines(999))

		await hook["tool.execute.before"](makeInput("edit"), output)

		expect(output.args.content).toBeDefined()
	})

	test("ignores non-string content", async () => {
		const hook = createHook()
		const output = { args: { filePath: "/tmp/test.ts", content: 42 } as Record<string, unknown> }

		await hook["tool.execute.before"](makeInput(), output)

		expect(output.args.content).toBe(42)
	})

	test("handles writefile tool name", async () => {
		const hook = createHook()
		const output = makeOutput(lines(201))

		await expect(
			hook["tool.execute.before"](makeInput("writefile"), output),
		).rejects.toThrow("Write Size Guard")
	})

	test("handles Write tool name case-insensitively", async () => {
		const hook = createHook()
		const output = makeOutput(lines(201))

		await expect(
			hook["tool.execute.before"](makeInput("Write"), output),
		).rejects.toThrow("Write Size Guard")
	})

	test("allows empty content", async () => {
		const hook = createHook()
		const output = makeOutput("")

		await hook["tool.execute.before"](makeInput(), output)

		expect(output.args.content).toBe("")
	})

	test("only exposes tool.execute.before handler", () => {
		const hook = createHook()

		expect(hook["tool.execute.before"]).toBeDefined()
		expect(Object.keys(hook)).toEqual(["tool.execute.before"])
	})
})
