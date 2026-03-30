import { describe, expect, test } from "bun:test"
import { buildCausalAnalysisBlock } from "./causal-analysis-prompts"

describe("causal-analysis-prompts", () => {
	test("returns null when failures below threshold", () => {
		expect(buildCausalAnalysisBlock(1, 2)).toBeNull()
	})

	test("returns CA template when failures >= threshold", () => {
		const block = buildCausalAnalysisBlock(2, 2)
		expect(block).not.toBeNull()
		expect(block!.content).toContain("因果分析")
		expect(block!.content).toContain("CA-01")
		expect(block!.content).toContain("2")
		expect(block!.priority).toBe("critical")
	})

	test("includes 5 Whys in template", () => {
		const block = buildCausalAnalysisBlock(3, 2)
		expect(block).not.toBeNull()
		expect(block!.content).toContain("5 Whys")
	})

	test("includes problem statement section", () => {
		const block = buildCausalAnalysisBlock(2, 2)
		expect(block).not.toBeNull()
		expect(block!.content).toContain("问题陈述")
		expect(block!.content).toContain("现象")
		expect(block!.content).toContain("位置")
	})

	test("includes causal chain section", () => {
		const block = buildCausalAnalysisBlock(2, 2)
		expect(block).not.toBeNull()
		expect(block!.content).toContain("因果分析")
		expect(block!.content).toContain("近因")
		expect(block!.content).toContain("促成条件")
	})
})
