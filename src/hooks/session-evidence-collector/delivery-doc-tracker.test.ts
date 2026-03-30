import { describe, expect, test } from "bun:test"
import { getCognitiveState, deleteCognitiveSession } from "../cognitive-governance-shared/state"
import {
	trackDeliveryEvidence,
	trackDocumentationEvidence,
	isDocFile,
	isPublicInterfaceFile,
	isBuildCommand,
	isTestCommand,
} from "./delivery-doc-tracker"

function freshState(id: string) {
	deleteCognitiveSession(id)
	return getCognitiveState(id)
}

describe("delivery-doc-tracker", () => {
	describe("trackDeliveryEvidence", () => {
		test("records code edit and increments codeChangesSinceBuild", () => {
			const state = freshState("dv-code-edit")
			trackDeliveryEvidence(state, "edit", { filePath: "src/hooks/index.ts" }, "")
			expect(state.deliveryEvidence.codeChangesSinceBuild).toBe(1)
			expect(state.deliveryEvidence.lastCodeChangeTimestamp).toBeGreaterThan(0)
			deleteCognitiveSession("dv-code-edit")
		})

		test("ignores markdown files for code change tracking", () => {
			const state = freshState("dv-md-ignore")
			trackDeliveryEvidence(state, "edit", { filePath: "docs/README.md" }, "")
			expect(state.deliveryEvidence.codeChangesSinceBuild).toBe(0)
			deleteCognitiveSession("dv-md-ignore")
		})

		test("records successful build and resets codeChangesSinceBuild", () => {
			const state = freshState("dv-build-success")
			state.deliveryEvidence.codeChangesSinceBuild = 3
			trackDeliveryEvidence(state, "bash", { command: "bun run build" }, "Bundled 50 modules\nexit code 0")
			expect(state.deliveryEvidence.codeChangesSinceBuild).toBe(0)
			expect(state.deliveryEvidence.lastBuildTimestamp).toBeGreaterThan(0)
			expect(state.deliveryEvidence.lastBuildCommand).toBe("bun run build")
			expect(state.deliveryEvidence.buildExitCode).toBe(0)
			deleteCognitiveSession("dv-build-success")
		})

		test("records failed build without resetting codeChangesSinceBuild", () => {
			const state = freshState("dv-build-fail")
			state.deliveryEvidence.codeChangesSinceBuild = 2
			trackDeliveryEvidence(state, "bash", { command: "npm run build" }, "error TS2307\nexit code 1")
			expect(state.deliveryEvidence.codeChangesSinceBuild).toBe(2)
			expect(state.deliveryEvidence.buildExitCode).toBe(1)
			deleteCognitiveSession("dv-build-fail")
		})

		test("records successful test run", () => {
			const state = freshState("dv-test-success")
			trackDeliveryEvidence(state, "bash", { command: "bun test" }, "99 pass\n0 fail\nexit code 0")
			expect(state.deliveryEvidence.lastTestResult).toBe("pass")
			expect(state.deliveryEvidence.lastTestTimestamp).toBeGreaterThan(0)
			expect(state.deliveryEvidence.testsSinceCodeChange).toBe(true)
			deleteCognitiveSession("dv-test-success")
		})

		test("records failed test run", () => {
			const state = freshState("dv-test-fail")
			trackDeliveryEvidence(state, "bash", { command: "bun test src/foo.test.ts" }, "1 fail\nexit code 1")
			expect(state.deliveryEvidence.lastTestResult).toBe("fail")
			deleteCognitiveSession("dv-test-fail")
		})

		test("code edit after test resets testsSinceCodeChange", () => {
			const state = freshState("dv-test-reset")
			state.deliveryEvidence.testsSinceCodeChange = true
			trackDeliveryEvidence(state, "write", { filePath: "src/main.ts" }, "")
			expect(state.deliveryEvidence.testsSinceCodeChange).toBe(false)
			deleteCognitiveSession("dv-test-reset")
		})
	})

	describe("trackDocumentationEvidence", () => {
		test("records doc file change", () => {
			const state = freshState("dg-doc-change")
			trackDocumentationEvidence(state, "edit", { filePath: "docs/architecture/overview.md" })
			expect(state.documentationEvidence.docChanges).toHaveLength(1)
			expect(state.documentationEvidence.lastDocChangeTimestamp).toBeGreaterThan(0)
			deleteCognitiveSession("dg-doc-change")
		})

		test("records AGENTS.md as doc change", () => {
			const state = freshState("dg-agents")
			trackDocumentationEvidence(state, "edit", { filePath: "/project/AGENTS.md" })
			expect(state.documentationEvidence.docChanges).toHaveLength(1)
			deleteCognitiveSession("dg-agents")
		})

		test("records public interface change and increments drift counter", () => {
			const state = freshState("dg-interface")
			trackDocumentationEvidence(state, "edit", { filePath: "src/hooks/fix-lifecycle-gate/index.ts" })
			expect(state.documentationEvidence.publicInterfaceChanges).toHaveLength(1)
			expect(state.documentationEvidence.publicInterfaceChanges[0].changeType).toBe("hook")
			expect(state.documentationEvidence.codeChangesWithoutDocUpdate).toBe(1)
			deleteCognitiveSession("dg-interface")
		})

		test("records config schema change as config type", () => {
			const state = freshState("dg-config")
			trackDocumentationEvidence(state, "edit", { filePath: "src/config/schema/hooks.ts" })
			expect(state.documentationEvidence.publicInterfaceChanges).toHaveLength(1)
			expect(state.documentationEvidence.publicInterfaceChanges[0].changeType).toBe("config")
			deleteCognitiveSession("dg-config")
		})

		test("records types.ts change as type", () => {
			const state = freshState("dg-types")
			trackDocumentationEvidence(state, "edit", { filePath: "src/hooks/cognitive-governance-shared/types.ts" })
			expect(state.documentationEvidence.publicInterfaceChanges).toHaveLength(1)
			expect(state.documentationEvidence.publicInterfaceChanges[0].changeType).toBe("type")
			deleteCognitiveSession("dg-types")
		})

		test("doc change resets codeChangesWithoutDocUpdate", () => {
			const state = freshState("dg-drift-reset")
			state.documentationEvidence.codeChangesWithoutDocUpdate = 5
			trackDocumentationEvidence(state, "edit", { filePath: "docs/README.md" })
			expect(state.documentationEvidence.codeChangesWithoutDocUpdate).toBe(0)
			deleteCognitiveSession("dg-drift-reset")
		})

		test("ignores non-public internal files", () => {
			const state = freshState("dg-internal")
			trackDocumentationEvidence(state, "edit", { filePath: "src/hooks/fix-lifecycle-gate/prompts.ts" })
			expect(state.documentationEvidence.publicInterfaceChanges).toHaveLength(0)
			expect(state.documentationEvidence.docChanges).toHaveLength(0)
			deleteCognitiveSession("dg-internal")
		})
	})

	describe("classifier helpers", () => {
		test("isDocFile matches doc paths", () => {
			expect(isDocFile("docs/README.md")).toBe(true)
			expect(isDocFile("docs/architecture/overview.md")).toBe(true)
			expect(isDocFile("AGENTS.md")).toBe(true)
			expect(isDocFile("/project/AGENTS.md")).toBe(true)
			expect(isDocFile("README.md")).toBe(true)
			expect(isDocFile("_meta/harness/config.yaml")).toBe(true)
			expect(isDocFile("src/main.ts")).toBe(false)
		})

		test("isPublicInterfaceFile matches public surfaces", () => {
			expect(isPublicInterfaceFile("src/hooks/atlas/index.ts")).toBeTruthy()
			expect(isPublicInterfaceFile("src/config/schema/hooks.ts")).toBeTruthy()
			expect(isPublicInterfaceFile("src/hooks/shared/types.ts")).toBeTruthy()
			expect(isPublicInterfaceFile("packages/kgs/src/query.ts")).toBeTruthy()
			expect(isPublicInterfaceFile("src/hooks/atlas/internal-helper.ts")).toBeFalsy()
		})

		test("isBuildCommand matches build patterns", () => {
			expect(isBuildCommand("bun run build")).toBe(true)
			expect(isBuildCommand("npm run build")).toBe(true)
			expect(isBuildCommand("tsc --noEmit")).toBe(true)
			expect(isBuildCommand("npx tsc")).toBe(true)
			expect(isBuildCommand("bun run typecheck")).toBe(true)
			expect(isBuildCommand("git status")).toBe(false)
		})

		test("isTestCommand matches test patterns", () => {
			expect(isTestCommand("bun test")).toBe(true)
			expect(isTestCommand("bun test src/foo.test.ts")).toBe(true)
			expect(isTestCommand("npm run test")).toBe(true)
			expect(isTestCommand("vitest run")).toBe(true)
			expect(isTestCommand("git status")).toBe(false)
		})
	})
})
