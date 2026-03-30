import { describe, expect, test } from "bun:test"
import type { DeliveryEvidence, DocumentationEvidence } from "../cognitive-governance-shared/types"
import {
	buildDeliveryVerificationBlock,
	buildDocumentationGovernanceBlock,
} from "./delivery-verification-prompts"

function makeDeliveryEvidence(overrides: Partial<DeliveryEvidence> = {}): DeliveryEvidence {
	return {
		lastBuildTimestamp: null,
		lastBuildCommand: null,
		buildExitCode: null,
		lastCodeChangeTimestamp: null,
		codeChangesSinceBuild: 0,
		lastTestTimestamp: null,
		lastTestResult: "unknown",
		testsSinceCodeChange: false,
		...overrides,
	}
}

function makeDocEvidence(overrides: Partial<DocumentationEvidence> = {}): DocumentationEvidence {
	return {
		publicInterfaceChanges: [],
		docChanges: [],
		codeChangesWithoutDocUpdate: 0,
		lastDocChangeTimestamp: null,
		...overrides,
	}
}

describe("delivery-verification-prompts", () => {
	describe("buildDeliveryVerificationBlock", () => {
		test("returns null when no code changes since build", () => {
			const ev = makeDeliveryEvidence({ codeChangesSinceBuild: 0 })
			expect(buildDeliveryVerificationBlock(ev)).toBeNull()
		})

		test("returns reminder with code change count", () => {
			const ev = makeDeliveryEvidence({ codeChangesSinceBuild: 5 })
			const block = buildDeliveryVerificationBlock(ev)
			expect(block).not.toBeNull()
			expect(block!.content).toContain("5")
			expect(block!.content).toContain("交付验证")
			expect(block!.priority).toBe("high")
		})

		test("includes build command hint when last build was successful", () => {
			const ev = makeDeliveryEvidence({
				codeChangesSinceBuild: 3,
				lastBuildCommand: "bun run build",
			})
			const block = buildDeliveryVerificationBlock(ev)
			expect(block).not.toBeNull()
			expect(block!.content).toContain("bun run build")
		})
	})

	describe("buildDocumentationGovernanceBlock", () => {
		test("returns null when drift below threshold", () => {
			const ev = makeDocEvidence({ codeChangesWithoutDocUpdate: 2 })
			expect(buildDocumentationGovernanceBlock(ev, 3)).toBeNull()
		})

		test("returns reminder when drift >= threshold", () => {
			const ev = makeDocEvidence({ codeChangesWithoutDocUpdate: 4 })
			const block = buildDocumentationGovernanceBlock(ev, 3)
			expect(block).not.toBeNull()
			expect(block!.content).toContain("4")
			expect(block!.content).toContain("文档同步")
			expect(block!.priority).toBe("medium")
		})

		test("returns null when no drift", () => {
			const ev = makeDocEvidence({ codeChangesWithoutDocUpdate: 0 })
			expect(buildDocumentationGovernanceBlock(ev, 3)).toBeNull()
		})
	})
})
