import { describe, expect, test } from "bun:test"
import {
	classifyToolPhase,
	isExecuteTool,
	isCaptureToolCall,
} from "./phase-detector"

describe("methodology phase detector", () => {
	test("classifies apply_patch as execute tool", () => {
		expect(classifyToolPhase("apply_patch")).toBe("execute")
		expect(isExecuteTool("apply_patch")).toBe(true)
	})

	test("detects capture call from direct filePath", () => {
		expect(
			isCaptureToolCall("write", { filePath: "/tmp/project/_meta/knowledge/lessons-learned.md" }),
		).toBe(true)
	})

	test("detects capture call from apply_patch patchText", () => {
		const patchText = [
			"*** Begin Patch",
			"*** Update File: _meta/knowledge/pitfalls.md",
			"@@",
			"-old",
			"+new",
			"*** End Patch",
		].join("\n")

		expect(isCaptureToolCall("apply_patch", { patchText })).toBe(true)
	})

	test("returns false for non-capture execute call", () => {
		expect(isCaptureToolCall("apply_patch", { patchText: "*** Begin Patch\n*** Update File: src/index.ts\n*** End Patch" })).toBe(false)
	})
})
