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

	test("includes CA-03 counterfactual by default", () => {
		const block = buildCausalAnalysisBlock(2, 2)
		expect(block).not.toBeNull()
		expect(block!.content).toContain("CA-03")
		expect(block!.content).toContain("反事实推导")
		expect(block!.content).toContain("替代假说")
	})

	test("includes CA-04 boundary closure by default", () => {
		const block = buildCausalAnalysisBlock(2, 2)
		expect(block).not.toBeNull()
		expect(block!.content).toContain("CA-04")
		expect(block!.content).toContain("问题边界")
		expect(block!.content).toContain("验收标准")
		expect(block!.content).toContain("行动计划")
	})

	test("excludes CA-03 when include_counterfactual is false", () => {
		const block = buildCausalAnalysisBlock(2, 2, { include_counterfactual: false })
		expect(block).not.toBeNull()
		expect(block!.content).not.toContain("CA-03")
		expect(block!.content).not.toContain("反事实推导")
	})

	test("excludes CA-04 when include_boundary_closure is false", () => {
		const block = buildCausalAnalysisBlock(2, 2, { include_boundary_closure: false })
		expect(block).not.toBeNull()
		expect(block!.content).not.toContain("CA-04")
		expect(block!.content).not.toContain("问题边界")
	})

	test("still includes CA-01 and CA-02 when CA-03/04 disabled", () => {
		const block = buildCausalAnalysisBlock(2, 2, {
			include_counterfactual: false,
			include_boundary_closure: false,
		})
		expect(block).not.toBeNull()
		expect(block!.content).toContain("CA-01")
		expect(block!.content).toContain("CA-02")
		expect(block!.content).toContain("5 Whys")
	})

	test("header shows full CA range (CA-01 → CA-04)", () => {
		const block = buildCausalAnalysisBlock(2, 2)
		expect(block!.content).toContain("CA-01 → CA-04")
	})
})
