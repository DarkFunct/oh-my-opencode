import { describe, expect, test } from "bun:test"
import {
	buildRetrospectiveBlock,
	DEFAULT_RETROSPECTIVE_CONFIG,
	type RetrospectiveConfig,
} from "./retrospective-prompts"

describe("retrospective-prompts", () => {
	const config = DEFAULT_RETROSPECTIVE_CONFIG

	test("returns null when disabled", () => {
		const disabled: RetrospectiveConfig = { ...config, enabled: false }
		const result = buildRetrospectiveBlock(10, disabled)
		expect(result).toBeNull()
	})

	test("returns null when failures below threshold", () => {
		const result = buildRetrospectiveBlock(3, config)
		expect(result).toBeNull()
	})

	test("returns retrospective block when failures >= threshold", () => {
		const result = buildRetrospectiveBlock(4, config)
		expect(result).not.toBeNull()
		expect(result!.content).toContain("复盘协议")
		expect(result!.content).toContain("4")
	})

	test("includes timeline review section", () => {
		const result = buildRetrospectiveBlock(5, config)
		expect(result!.content).toContain("时间线回顾")
	})

	test("includes pattern recognition section", () => {
		const result = buildRetrospectiveBlock(5, config)
		expect(result!.content).toContain("模式识别")
	})

	test("includes root cause reassessment section", () => {
		const result = buildRetrospectiveBlock(5, config)
		expect(result!.content).toContain("根因重评估")
	})

	test("includes strategy adjustment section", () => {
		const result = buildRetrospectiveBlock(5, config)
		expect(result!.content).toContain("策略调整")
	})

	test("uses configured priority", () => {
		const result = buildRetrospectiveBlock(4, config)
		expect(result!.priority).toBe("critical")
	})

	test("uses custom priority", () => {
		const custom: RetrospectiveConfig = { ...config, retrospective_priority: "high" }
		const result = buildRetrospectiveBlock(4, custom)
		expect(result!.priority).toBe("high")
	})

	test("uses custom threshold", () => {
		const custom: RetrospectiveConfig = { ...config, retrospective_threshold: 6 }
		expect(buildRetrospectiveBlock(5, custom)).toBeNull()
		expect(buildRetrospectiveBlock(6, custom)).not.toBeNull()
	})
})
