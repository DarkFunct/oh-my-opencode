import { describe, expect, test } from "bun:test"
import { buildCognitiveDirective } from "./prompts"
import type { CognitiveAssessment } from "./conversation-analyzer"

function makeAssessment(overrides: Partial<CognitiveAssessment>): CognitiveAssessment {
	return {
		currentLayer: "understanding",
		dimensionsCovered: ["technical", "empirical", "engineering"],
		dimensionsGap: ["theoretical", "philosophical"],
		errorCount: 0,
		unresolvedErrors: 0,
		fixAttempts: 0,
		readCount: 3,
		grepCount: 1,
		editedFilesCount: 1,
		pendingVerificationEditsCount: 0,
		hasVerification: false,
		captureNeeded: false,
		captureUrgency: "none",
		...overrides,
	}
}

describe("cognitive-governance prompts", () => {
	test("does not emit verification reminder for non-verifiable edit backlog", () => {
		const directive = buildCognitiveDirective(makeAssessment({
			editedFilesCount: 1,
			pendingVerificationEditsCount: 0,
		}))

		expect(directive ?? "").not.toContain("Verification Reminder")
	})

	test("emits verification reminder when pending verifiable edits exist", () => {
		const directive = buildCognitiveDirective(makeAssessment({
			pendingVerificationEditsCount: 2,
		}))

		expect(directive).toBeTruthy()
		expect(directive?.includes("Verification Reminder")).toBe(true)
		expect(directive?.includes("2 verifiable edit(s)")).toBe(true)
	})
})
