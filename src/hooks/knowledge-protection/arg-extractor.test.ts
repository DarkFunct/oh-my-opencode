import { describe, expect, test } from "bun:test"
import { extractMatchableArg, extractConditionArg } from "./arg-extractor"

describe("extractMatchableArg", () => {
	test("extracts bash command arg", () => {
		const result = extractMatchableArg("bash", { command: "docker compose up" }, "command")
		expect(result).toBe("docker compose up")
	})

	test("extracts edit filePath arg", () => {
		const result = extractMatchableArg("edit", { filePath: "/foo/bar.ts" }, "filePath")
		expect(result).toBe("/foo/bar.ts")
	})

	test("extracts grep pattern arg", () => {
		const result = extractMatchableArg("grep", { pattern: "TODO" }, "pattern")
		expect(result).toBe("TODO")
	})

	test("extracts skill name arg", () => {
		const result = extractMatchableArg("skill", { name: "git-master" }, "name")
		expect(result).toBe("git-master")
	})

	test("extracts lsp_rename newName arg", () => {
		const result = extractMatchableArg("lsp_rename", { newName: "fooBar" }, "newName")
		expect(result).toBe("fooBar")
	})

	test("returns null for unknown tool with unknown arg", () => {
		const result = extractMatchableArg("unknown_tool", { prompt: "do stuff" }, "prompt")
		expect(result).toBeNull()
	})

	test("returns null when arg value is not a string", () => {
		const result = extractMatchableArg("bash", { command: 123 }, "command")
		expect(result).toBeNull()
	})

	test("returns null when arg key is missing from args", () => {
		const result = extractMatchableArg("bash", { workdir: "/tmp" }, "command")
		expect(result).toBeNull()
	})

	test("C-017: never extracts prompt/description (NL content)", () => {
		const result = extractMatchableArg("task", { prompt: "do something complex" }, "prompt")
		expect(result).toBeNull()
	})

	test("falls back to TOOL_ARG_MAP when argName is not in allowlist", () => {
		const result = extractMatchableArg("bash", { command: "ls -la" }, "weirdArg")
		expect(result).toBe("ls -la")
	})

	test("returns null for unknown tool with non-allowlisted argName", () => {
		const result = extractMatchableArg("some_random_tool", { data: "xyz" }, "data")
		expect(result).toBeNull()
	})
})

describe("extractConditionArg", () => {
	test("extracts string arg by name", () => {
		const result = extractConditionArg({ workdir: "/Users/hanshu/packages/kgs" }, "workdir")
		expect(result).toBe("/Users/hanshu/packages/kgs")
	})

	test("returns null for non-string arg", () => {
		const result = extractConditionArg({ timeout: 5000 }, "timeout")
		expect(result).toBeNull()
	})

	test("returns null for missing arg", () => {
		const result = extractConditionArg({}, "workdir")
		expect(result).toBeNull()
	})
})
