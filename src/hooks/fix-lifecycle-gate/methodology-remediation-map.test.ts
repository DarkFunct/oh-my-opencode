import { describe, expect, test } from "bun:test"
import type { MethodologyDimension } from "../cognitive-governance-shared/types"
import { buildRemediationGuide, getMissingDimensions } from "./methodology-remediation-map"

describe("getMissingDimensions", () => {
	test("returns all dimensions when covered set is empty", () => {
		const missing = getMissingDimensions(new Set<MethodologyDimension>())
		expect(missing).toEqual(["technical", "empirical", "theoretical", "engineering", "philosophical"])
	})

	test("returns only uncovered dimensions", () => {
		const covered = new Set<MethodologyDimension>(["technical", "philosophical"])
		const missing = getMissingDimensions(covered)
		expect(missing).toEqual(["empirical", "theoretical", "engineering"])
	})

	test("returns empty array when all dimensions are covered", () => {
		const covered = new Set<MethodologyDimension>(["technical", "empirical", "theoretical", "engineering", "philosophical"])
		const missing = getMissingDimensions(covered)
		expect(missing).toEqual([])
	})
})

describe("buildRemediationGuide", () => {
	test("returns empty string when missing list is empty", () => {
		const guide = buildRemediationGuide([])
		expect(guide).toBe("")
	})

	test("contains description and read targets for one missing dimension", () => {
		const guide = buildRemediationGuide(["technical"])
		expect(guide).toContain("### technical: 技术维度 — 工具、编译、类型检查")
		expect(guide).toContain("tsconfig.json / package.json（项目配置）")
		expect(guide).toContain("运行 lsp_diagnostics / typecheck / build 验证编译结果")
	})

	test("contains descriptions for multiple missing dimensions", () => {
		const guide = buildRemediationGuide(["empirical", "engineering"])
		expect(guide).toContain("### empirical: 经验维度 — 观察、实验、复现")
		expect(guide).toContain("### engineering: 工程维度 — 风险、边界、依赖、约束")
	})
})
