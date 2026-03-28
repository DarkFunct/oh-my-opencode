import { describe, expect, test } from "bun:test"
import { extractLatestStageBVerdict } from "./stage-b-verdict-parser"

type TestMessage = {
	info: { role: "assistant" | "user" }
	parts: Array<{ type: "text" | "reasoning"; text: string }>
}

describe("stage-b-verdict-parser", () => {
	test("extracts valid stage-b verdict from assistant text block", () => {
		const messages: TestMessage[] = [
			{
				info: { role: "assistant" },
				parts: [
					{
						type: "text",
						text: "<cognitive_stage_b>{\"conclusion\":\"pass\",\"layer\":\"rationality\",\"dimensions\":[\"technical\",\"engineering\"],\"confidence\":0.92,\"reasons\":[\"evidence and verification complete\"]}</cognitive_stage_b>",
					},
				],
			},
		]

		const verdict = extractLatestStageBVerdict(messages as never)

		expect(verdict).not.toBeNull()
		expect(verdict?.stage).toBe("B")
		expect(verdict?.source).toBe("llm-stage-b")
		expect(verdict?.conclusion).toBe("pass")
	})

	test("returns null for invalid stage-b payload", () => {
		const messages: TestMessage[] = [
			{
				info: { role: "assistant" },
				parts: [
					{
						type: "text",
						text: "<cognitive_stage_b>{\"conclusion\":\"unknown\"}</cognitive_stage_b>",
					},
				],
			},
		]

		const verdict = extractLatestStageBVerdict(messages as never)
		expect(verdict).toBeNull()
	})
})
