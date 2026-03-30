import { describe, expect, test } from "bun:test"
import {
	inferTaskComplexity,
	evaluateMethodologyCoverage,
	DEFAULT_COMPLEXITY_THRESHOLDS,
	DEFAULT_METHODOLOGY_COVERAGE_CONFIG,
	type MethodologyCoverageConfig,
} from "./methodology-coverage-gate"

describe("inferTaskComplexity", () => {
	const thresholds = DEFAULT_COMPLEXITY_THRESHOLDS

	test("returns simple when all counts are low", () => {
		expect(inferTaskComplexity(1, 1, 1, thresholds)).toBe("simple")
	})

	test("returns standard when edited files reach standard threshold", () => {
		expect(inferTaskComplexity(4, 1, 1, thresholds)).toBe("standard")
	})

	test("returns standard when module count reaches standard threshold", () => {
		expect(inferTaskComplexity(1, 2, 1, thresholds)).toBe("standard")
	})

	test("returns standard when todo count reaches standard threshold", () => {
		expect(inferTaskComplexity(1, 1, 3, thresholds)).toBe("standard")
	})

	test("returns complex when edited files reach complex threshold", () => {
		expect(inferTaskComplexity(10, 1, 1, thresholds)).toBe("complex")
	})

	test("returns complex when module count reaches complex threshold", () => {
		expect(inferTaskComplexity(1, 3, 1, thresholds)).toBe("complex")
	})

	test("returns complex when todo count reaches complex threshold", () => {
		expect(inferTaskComplexity(1, 1, 8, thresholds)).toBe("complex")
	})

	test("complex takes priority over standard", () => {
		expect(inferTaskComplexity(10, 2, 3, thresholds)).toBe("complex")
	})

	test("uses custom thresholds", () => {
		const custom = { ...thresholds, complex_file_count: 5, standard_file_count: 2 }
		expect(inferTaskComplexity(3, 1, 1, custom)).toBe("standard")
		expect(inferTaskComplexity(5, 1, 1, custom)).toBe("complex")
	})
})

describe("evaluateMethodologyCoverage", () => {
	const config = DEFAULT_METHODOLOGY_COVERAGE_CONFIG

	test("returns no block when disabled", () => {
		const disabled: MethodologyCoverageConfig = { ...config, enabled: false }
		const result = evaluateMethodologyCoverage(0, "complex", 0, disabled)
		expect(result.shouldBlock).toBe(false)
		expect(result.reason).toBeNull()
	})

	test("returns no block when simple task has >= 2 dimensions", () => {
		const result = evaluateMethodologyCoverage(2, "simple", 0, config)
		expect(result.shouldBlock).toBe(false)
		expect(result.reason).toBeNull()
	})

	test("warns when simple task has < 2 dimensions (first warning)", () => {
		const result = evaluateMethodologyCoverage(1, "simple", 0, config)
		expect(result.shouldBlock).toBe(false)
		expect(result.reason).toBe("coverage_insufficient")
		expect(result.deficit).toBe(1)
	})

	test("returns no block when standard task has >= 3 dimensions", () => {
		const result = evaluateMethodologyCoverage(3, "standard", 0, config)
		expect(result.shouldBlock).toBe(false)
		expect(result.reason).toBeNull()
	})

	test("warns when standard task has < 3 dimensions", () => {
		const result = evaluateMethodologyCoverage(1, "standard", 0, config)
		expect(result.shouldBlock).toBe(false)
		expect(result.reason).toBe("coverage_insufficient")
		expect(result.deficit).toBe(2)
	})

	test("returns no block when complex task has 5 dimensions", () => {
		const result = evaluateMethodologyCoverage(5, "complex", 0, config)
		expect(result.shouldBlock).toBe(false)
		expect(result.reason).toBeNull()
	})

	test("warns when complex task has < 5 dimensions", () => {
		const result = evaluateMethodologyCoverage(3, "complex", 0, config)
		expect(result.shouldBlock).toBe(false)
		expect(result.reason).toBe("coverage_insufficient")
		expect(result.deficit).toBe(2)
	})

	test("blocks after warning threshold exceeded", () => {
		const result = evaluateMethodologyCoverage(1, "standard", 3, config)
		expect(result.shouldBlock).toBe(true)
		expect(result.reason).toBe("coverage_insufficient")
	})

	test("blocks exactly at warning threshold", () => {
		const result = evaluateMethodologyCoverage(1, "standard", 3, config)
		expect(result.shouldBlock).toBe(true)
	})

	test("does not block when warnings below threshold", () => {
		const result = evaluateMethodologyCoverage(1, "standard", 2, config)
		expect(result.shouldBlock).toBe(false)
		expect(result.reason).toBe("coverage_insufficient")
	})

	test("uses custom min_dimensions", () => {
		const custom: MethodologyCoverageConfig = { ...config, min_dimensions_simple: 3 }
		const result = evaluateMethodologyCoverage(2, "simple", 0, custom)
		expect(result.shouldBlock).toBe(false)
		expect(result.reason).toBe("coverage_insufficient")
		expect(result.deficit).toBe(1)
	})

	test("uses custom methodology_warning_threshold", () => {
		const custom: MethodologyCoverageConfig = { ...config, methodology_warning_threshold: 1 }
		const result = evaluateMethodologyCoverage(1, "simple", 1, custom)
		expect(result.shouldBlock).toBe(true)
	})

	test("reports required and actual dimensions", () => {
		const result = evaluateMethodologyCoverage(1, "complex", 0, config)
		expect(result.required).toBe(5)
		expect(result.actual).toBe(1)
		expect(result.deficit).toBe(4)
	})
})
