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
		expect(guide).toContain("### technical: Technical — tools, compilation, type checking")
		expect(guide).toContain("tsconfig.json / package.json (project configuration)")
		expect(guide).toContain("Run lsp_diagnostics / typecheck / build to verify compilation results")
	})

	test("contains descriptions for multiple missing dimensions", () => {
		const guide = buildRemediationGuide(["empirical", "engineering"])
		expect(guide).toContain("### empirical: Empirical — observation, experimentation, reproduction")
		expect(guide).toContain("### engineering: Engineering — risk, boundaries, dependencies, constraints")
	})
})
