import { describe, expect, test } from "bun:test"
import {
	evaluateBatchClassification,
	DEFAULT_BATCH_CLASSIFICATION_CONFIG,
	type BatchClassificationConfig,
} from "./batch-classification-gate"

describe("batch-classification-gate", () => {
	const config = DEFAULT_BATCH_CLASSIFICATION_CONFIG

	test("returns no block when disabled", () => {
		const disabled: BatchClassificationConfig = { ...config, enabled: false }
		const todos = Array.from({ length: 10 }, () => "unclassified item")
		const result = evaluateBatchClassification(todos, disabled)
		expect(result.shouldBlock).toBe(false)
		expect(result.reason).toBeNull()
	})

	test("returns no block when todo count is at threshold", () => {
		const todos = Array.from({ length: 5 }, () => "some item")
		const result = evaluateBatchClassification(todos, config)
		expect(result.shouldBlock).toBe(false)
		expect(result.reason).toBeNull()
	})

	test("returns no block when todo count is below threshold", () => {
		const todos = ["item 1", "item 2", "item 3"]
		const result = evaluateBatchClassification(todos, config)
		expect(result.shouldBlock).toBe(false)
	})

	test("blocks when todos exceed threshold and lack classification markers", () => {
		const todos = Array.from({ length: 6 }, (_, i) => `do thing ${i}`)
		const result = evaluateBatchClassification(todos, config)
		expect(result.shouldBlock).toBe(true)
		expect(result.reason).toBe("batch_unclassified")
		expect(result.itemCount).toBe(6)
	})

	test("does not block when todos have bracket classification markers", () => {
		const todos = [
			"[P0] fix critical bug",
			"[P1] add feature",
			"[P0] update config",
			"[P2] cleanup docs",
			"[P1] refactor module",
			"[P2] add test",
		]
		const result = evaluateBatchClassification(todos, config)
		expect(result.shouldBlock).toBe(false)
		expect(result.reason).toBeNull()
	})

	test("does not block when todos have parenthesis classification markers", () => {
		const todos = [
			"(auth) login flow",
			"(auth) signup flow",
			"(config) add schema",
			"(config) validate",
			"(test) add unit tests",
			"(test) add e2e tests",
		]
		const result = evaluateBatchClassification(todos, config)
		expect(result.shouldBlock).toBe(false)
		expect(result.reason).toBeNull()
	})

	test("blocks when most todos lack markers", () => {
		const todos = [
			"[P0] fix critical bug",
			"do thing without marker",
			"another unmarked todo",
			"yet another unmarked todo",
			"still no marker",
			"no marker here either",
		]
		const result = evaluateBatchClassification(todos, config)
		expect(result.shouldBlock).toBe(true)
		expect(result.reason).toBe("batch_unclassified")
	})

	test("uses custom batch threshold", () => {
		const custom: BatchClassificationConfig = { ...config, batch_threshold: 3 }
		const todos = ["item 1", "item 2", "item 3", "item 4"]
		const result = evaluateBatchClassification(todos, custom)
		expect(result.shouldBlock).toBe(true)
		expect(result.reason).toBe("batch_unclassified")
	})

	test("uses custom classification marker patterns", () => {
		const custom: BatchClassificationConfig = {
			...config,
			classification_marker_patterns: ["^#\\d+"],
		}
		const todos = [
			"#1 fix bug",
			"#2 add feature",
			"#3 update docs",
			"#4 refactor",
			"#5 cleanup",
			"#6 test",
		]
		const result = evaluateBatchClassification(todos, custom)
		expect(result.shouldBlock).toBe(false)
	})

	test("reports threshold in result", () => {
		const todos = Array.from({ length: 6 }, (_, i) => `do thing ${i}`)
		const result = evaluateBatchClassification(todos, config)
		expect(result.threshold).toBe(5)
	})

	test("handles empty todo list", () => {
		const result = evaluateBatchClassification([], config)
		expect(result.shouldBlock).toBe(false)
		expect(result.reason).toBeNull()
	})

	test("requires majority of todos to have markers", () => {
		const todos = [
			"[P0] classified",
			"[P1] classified",
			"[P2] classified",
			"unclassified",
			"unclassified",
			"unclassified",
		]
		const result = evaluateBatchClassification(todos, config)
		expect(result.shouldBlock).toBe(true)
	})
})
