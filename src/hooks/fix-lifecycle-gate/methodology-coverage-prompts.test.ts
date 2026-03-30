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

		expect(message).toContain("任务复杂度 standard，要求 3 维方法论覆盖，当前仅 1 维（差 2）。")
		expect(message).toContain("已覆盖维度: technical")
		expect(message).toContain("缺失维度: empirical, theoretical, engineering, philosophical")
		expect(message).toContain("已连续警告: 2 次")
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

		expect(message).toContain("**缺失维度与解除步骤：**")
		expect(message).toContain("### empirical: 经验维度 — 观察、实验、复现")
		expect(message).toContain("### philosophical: 哲学维度 — 元认知、前提质疑、权衡")
		expect(message).toContain("完成以上任意缺失维度的操作后，门控将自动解除。")
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

		expect(message).toContain("经过 7 次响应尝试，方法论覆盖仍未满足要求。")
		expect(message).toContain("已覆盖: technical, empirical")
		expect(message).toContain("仍缺失: theoretical, engineering, philosophical")
		expect(message).toContain("Session 即将终止。如需继续，请在新会话中先完成缺失维度的认知操作。")
	})
})
