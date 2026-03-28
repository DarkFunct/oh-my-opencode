import { describe, expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { getCognitiveState, deleteCognitiveSession } from "../cognitive-governance-shared/state"
import { evaluateGaiaStageA, evaluateGaiaStageAFromThinking } from "./gaia-stage-a-adapter"

describe("gaia-stage-a-adapter", () => {
	test("returns pass for evidence-bound reasoning", () => {
		const result = evaluateGaiaStageAFromThinking(
			[
				"Evidence: src/hooks/x.ts:L12-L30 and logs confirm the root cause.",
				"Because parser state leaks, therefore retries fail.",
				"Plan: patch bounded scope, verify by test and build, rollback on failure.",
				"Trade-off and assumption challenge are documented for meta-cognition.",
			].join(" "),
			{ includePerceptionDefaults: false },
		)

		expect(result).not.toBeNull()
		expect(result?.verdict.conclusion).toBe("pass")
		expect(result?.verdict.stage).toBe("A")
		expect(result?.verdict.dimensions).toContain("technical")
	})

	test("returns pending for medium-risk suspicious sample", () => {
		const result = evaluateGaiaStageAFromThinking(
			"Evidence src/main.ts:L1-L2 because parser leaks therefore retries fail. I will implement patch now.",
			{ includePerceptionDefaults: false },
		)

		expect(result).not.toBeNull()
		expect(result?.verdict.conclusion).toBe("pending")
		expect(result?.verdict.risk).toBe("medium")
		expect(result?.verdict.reasons).toContain("execution intent detected without verification plan")
	})

	test("returns fail for high-risk suspicious sample", () => {
		const result = evaluateGaiaStageAFromThinking("I will implement fix now.", {
			includePerceptionDefaults: false,
		})

		expect(result).not.toBeNull()
		expect(result?.verdict.conclusion).toBe("fail")
		expect(result?.verdict.risk).toBe("high")
	})

	test("evaluates from state cognitive evidence", () => {
		const state = getCognitiveState("gaia-stage-a-from-state")
		state.cognitiveEvidence.push({
			layer: "understanding",
			dimension: "technical",
			signal: "Evidence src/core/a.ts:L10-L20 because root cause therefore",
			timestamp: Date.now(),
		})

		const result = evaluateGaiaStageA(state, { includePerceptionDefaults: false })

		expect(result).not.toBeNull()
		expect(result?.verdict.stage).toBe("A")

		deleteCognitiveSession("gaia-stage-a-from-state")
	})

	test("supports perception defaults options from runtime config", async () => {
		const workspaceRoot = await mkdtemp(join(tmpdir(), "omo-perception-config-"))

		try {
			await writeFile(
				join(workspaceRoot, "README.md"),
				[
					"Evidence: src/core/x.ts:L10-L12",
					"Because parser state leaks therefore retries fail.",
					"Verify by test and build.",
				].join("\n"),
				"utf8",
			)

			const withoutDefaults = evaluateGaiaStageAFromThinking("I will implement fix now.", {
				includePerceptionDefaults: false,
			})
			const withDefaults = evaluateGaiaStageAFromThinking("I will implement fix now.", {
				includePerceptionDefaults: true,
				workspaceRoot,
				maxCharsPerFile: 12_000,
			})

			expect(withoutDefaults?.verdict.conclusion).toBe("fail")
			expect(withDefaults?.verdict.conclusion).not.toBe("fail")
		} finally {
			await rm(workspaceRoot, { recursive: true, force: true })
		}
	})
})
