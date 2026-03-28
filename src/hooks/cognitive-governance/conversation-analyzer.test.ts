import { describe, expect, test } from "bun:test"
import { getCognitiveState, deleteCognitiveSession } from "../cognitive-governance-shared/state"
import { assessCognition, determineCognitiveLayer } from "./conversation-analyzer"

describe("conversation-analyzer", () => {
	test("tracks pending verification edits from editsSinceLastVerification", () => {
		const state = getCognitiveState("conv-analyzer-pending")
		state.readCount = 2
		state.dimensionsCovered.add("technical")
		state.dimensionsCovered.add("empirical")
		state.fileEditHistory.set("src/foo.ts", {
			count: 1,
			lastEditTimestamp: Date.now(),
			tools: ["edit"],
		})
		state.editsSinceLastVerification = 1
		state.lastBuildResult = "success"

		const assessment = assessCognition(state)
		expect(assessment.pendingVerificationEditsCount).toBe(1)
		expect(assessment.hasVerification).toBe(false)

		deleteCognitiveSession("conv-analyzer-pending")
	})

	test("keeps layer at understanding when new edits are still unverified", () => {
		const state = getCognitiveState("conv-analyzer-layer")
		state.readCount = 3
		state.dimensionsCovered.add("technical")
		state.dimensionsCovered.add("engineering")
		state.fileEditHistory.set("src/bar.ts", {
			count: 1,
			lastEditTimestamp: Date.now(),
			tools: ["edit"],
		})
		state.lastBuildResult = "success"
		state.editsSinceLastVerification = 2

		expect(determineCognitiveLayer(state)).toBe("understanding")

		deleteCognitiveSession("conv-analyzer-layer")
	})

	test("uses gaia stage-a layer when cognitive evidence exists", () => {
		const state = getCognitiveState("conv-analyzer-gaia")
		state.readCount = 0
		state.cognitiveEvidence.push({
			layer: "rationality",
			dimension: "technical",
			signal: "Evidence src/hooks/x.ts:L10-L20 because root cause therefore fix plan verify test",
			timestamp: Date.now(),
		})
		state.cognitiveEvidence.push({
			layer: "rationality",
			dimension: "engineering",
			signal: "trade-off constraint rollback boundary",
			timestamp: Date.now(),
		})

		const layer = determineCognitiveLayer(state)
		expect(layer).toBe("rationality")

		const assessment = assessCognition(state)
		expect(assessment.currentLayer).toBe("rationality")
		expect(assessment.dimensionsCovered).toContain("technical")
		expect(assessment.dimensionsCovered).toContain("engineering")

		deleteCognitiveSession("conv-analyzer-gaia")
	})
})
