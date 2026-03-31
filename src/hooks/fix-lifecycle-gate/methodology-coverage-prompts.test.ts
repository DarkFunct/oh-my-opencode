import { describe, expect, test } from "bun:test"
import {
	buildMethodologyCoverageAbortMessage,
	buildMethodologyCoverageBlockMessage,
} from "./methodology-coverage-prompts"

describe("buildMethodologyCoverageBlockMessage", () => {
	test("includes complexity, required, actual, deficit, warnings, covered and missing dimensions", () => {
		const message = buildMethodologyCoverageBlockMessage({
			complexity: "standard",
			required: 3,
			actual: 1,
			deficit: 2,
			warningCount: 2,
			dimensionsCovered: new Set(["technical"]),
		})

		expect(message).toContain("Task complexity: standard. Required: 3 methodology dimensions, current: only 1 (deficit: 2).")
		expect(message).toContain("Covered dimensions: technical")
		expect(message).toContain("Missing dimensions: empirical, theoretical, engineering, philosophical")
		expect(message).toContain("Consecutive warnings: 2")
	})

	test("contains remediation guide for missing dimensions", () => {
		const message = buildMethodologyCoverageBlockMessage({
			complexity: "complex",
			required: 5,
			actual: 3,
			deficit: 2,
			warningCount: 4,
			dimensionsCovered: new Set(["technical", "theoretical", "engineering"]),
		})

		expect(message).toContain("**Missing Dimensions & Unblock Steps:**")
		expect(message).toContain("### empirical: Empirical — observation, experimentation, reproduction")
		expect(message).toContain("### philosophical: Philosophical — meta-cognition, premise questioning, tradeoffs")
		expect(message).toContain("Complete ANY missing dimension's actions above to automatically unblock this gate.")
	})
})

describe("buildMethodologyCoverageAbortMessage", () => {
	test("includes total responses, covered and missing dimensions, and termination notice", () => {
		const message = buildMethodologyCoverageAbortMessage({
			complexity: "complex",
			required: 5,
			actual: 2,
			deficit: 3,
			warningCount: 5,
			totalResponses: 7,
			dimensionsCovered: new Set(["technical", "empirical"]),
		})

		expect(message).toContain("After 7 response attempts, methodology coverage still does not meet requirements.")
		expect(message).toContain("Covered: technical, empirical")
		expect(message).toContain("Still missing: theoretical, engineering, philosophical")
		expect(message).toContain("Session will terminate. To continue, start a new session and complete the missing cognitive dimensions FIRST.")
	})
})
