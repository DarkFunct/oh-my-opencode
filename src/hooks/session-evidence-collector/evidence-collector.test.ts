import { describe, expect, test } from "bun:test"
import { getCognitiveState, deleteCognitiveSession } from "../cognitive-governance-shared/state"
import { isReadTool, isGrepTool, isExecuteTool, isCaptureTarget, detectMethodologyDimension } from "./evidence-signals"
import { computeErrorTraceDepth, computeFixTargetConsistency, hasReadKnowledgeFiles, isSameDirectionRetry } from "./failure-signals"
import { isFixAttempt } from "./text-matcher"

describe("evidence-signals", () => {
	test("isReadTool classifies correctly", () => {
		expect(isReadTool("read")).toBe(true)
		expect(isReadTool("glob")).toBe(true)
		expect(isReadTool("grep")).toBe(true)
		expect(isReadTool("lsp_diagnostics")).toBe(true)
		expect(isReadTool("webfetch")).toBe(true)
		expect(isReadTool("edit")).toBe(false)
		expect(isReadTool("bash")).toBe(false)
	})

	test("isGrepTool classifies correctly", () => {
		expect(isGrepTool("grep")).toBe(true)
		expect(isGrepTool("ast_grep_search")).toBe(true)
		expect(isGrepTool("read")).toBe(false)
	})

	test("isExecuteTool classifies correctly", () => {
		expect(isExecuteTool("edit")).toBe(true)
		expect(isExecuteTool("write")).toBe(true)
		expect(isExecuteTool("bash")).toBe(true)
		expect(isExecuteTool("ast_grep_replace")).toBe(true)
		expect(isExecuteTool("lsp_rename")).toBe(true)
		expect(isExecuteTool("read")).toBe(false)
		expect(isExecuteTool("grep")).toBe(false)
	})

	test("isCaptureTarget identifies knowledge files", () => {
		expect(isCaptureTarget("_meta/knowledge/pitfalls.md")).toBe(true)
		expect(isCaptureTarget("/path/_meta/knowledge/lessons-learned.md")).toBe(true)
		expect(isCaptureTarget("/path/to/constraints.md")).toBe(true)
		expect(isCaptureTarget("src/hooks/index.ts")).toBe(false)
	})

	test("detectMethodologyDimension — technical for bash", () => {
		const state = getCognitiveState("test-dim-1")
		const dim = detectMethodologyDimension(state, "bash")
		expect(dim).toBe("technical")
		expect(state.dimensionsCovered.has("technical")).toBe(true)
		deleteCognitiveSession("test-dim-1")
	})

	test("detectMethodologyDimension — engineering for tsconfig", () => {
		const state = getCognitiveState("test-dim-2")
		const dim = detectMethodologyDimension(state, "read", "tsconfig.json")
		expect(dim).toBe("engineering")
		expect(state.dimensionsCovered.has("engineering")).toBe(true)
		deleteCognitiveSession("test-dim-2")
	})

	test("detectMethodologyDimension — philosophical for harness", () => {
		const state = getCognitiveState("test-dim-3")
		const dim = detectMethodologyDimension(state, "read", "_meta/harness/methodology-chain.md")
		expect(dim).toBe("philosophical")
		deleteCognitiveSession("test-dim-3")
	})

	test("detectMethodologyDimension — empirical for pitfalls", () => {
		const state = getCognitiveState("test-dim-4")
		const dim = detectMethodologyDimension(state, "read", "_meta/knowledge/pitfalls.md")
		expect(dim).toBe("empirical")
		deleteCognitiveSession("test-dim-4")
	})

	test("detectMethodologyDimension — theoretical for architecture docs", () => {
		const state = getCognitiveState("test-dim-5")
		const dim = detectMethodologyDimension(state, "read", "docs/architecture/overview.md")
		expect(dim).toBe("theoretical")
		deleteCognitiveSession("test-dim-5")
	})
})

describe("failure-signals", () => {
	test("computeErrorTraceDepth — 0 when error files not read", () => {
		const state = getCognitiveState("test-trace-1")
		state.detectedErrors.push({
			pattern: "compilation",
			rawMessage: "error",
			tool: "bash",
			timestamp: Date.now(),
			filePath: "/src/foo.ts",
		})
		expect(computeErrorTraceDepth(state)).toBe(0)
		deleteCognitiveSession("test-trace-1")
	})

	test("computeErrorTraceDepth — 1 when all error files read", () => {
		const state = getCognitiveState("test-trace-2")
		state.detectedErrors.push({
			pattern: "compilation",
			rawMessage: "error",
			tool: "bash",
			timestamp: Date.now(),
			filePath: "/src/foo.ts",
		})
		state.readFiles.add("/src/foo.ts")
		expect(computeErrorTraceDepth(state)).toBe(1)
		deleteCognitiveSession("test-trace-2")
	})

	test("computeErrorTraceDepth — 1 when no error files (safe default)", () => {
		const state = getCognitiveState("test-trace-3")
		expect(computeErrorTraceDepth(state)).toBe(1)
		deleteCognitiveSession("test-trace-3")
	})

	test("computeFixTargetConsistency — 0 when editing wrong files", () => {
		const state = getCognitiveState("test-consist-1")
		state.detectedErrors.push({
			pattern: "compilation",
			rawMessage: "error",
			tool: "bash",
			timestamp: Date.now(),
			filePath: "/src/error-file.ts",
		})
		state.fileEditHistory.set("/src/other-file.ts", {
			count: 1,
			lastEditTimestamp: Date.now(),
			tools: ["edit"],
		})
		expect(computeFixTargetConsistency(state)).toBe(0)
		deleteCognitiveSession("test-consist-1")
	})

	test("computeFixTargetConsistency — 1 when editing correct files", () => {
		const state = getCognitiveState("test-consist-2")
		state.detectedErrors.push({
			pattern: "compilation",
			rawMessage: "error",
			tool: "bash",
			timestamp: Date.now(),
			filePath: "/src/foo.ts",
		})
		state.fileEditHistory.set("/src/foo.ts", {
			count: 1,
			lastEditTimestamp: Date.now(),
			tools: ["edit"],
		})
		expect(computeFixTargetConsistency(state)).toBe(1)
		deleteCognitiveSession("test-consist-2")
	})

	test("hasReadKnowledgeFiles — true when knowledge files read", () => {
		const state = getCognitiveState("test-knowledge-1")
		state.readFiles.add("_meta/knowledge/pitfalls.md")
		expect(hasReadKnowledgeFiles(state)).toBe(true)
		deleteCognitiveSession("test-knowledge-1")
	})

	test("hasReadKnowledgeFiles — false when no knowledge files read", () => {
		const state = getCognitiveState("test-knowledge-2")
		state.readFiles.add("src/index.ts")
		expect(hasReadKnowledgeFiles(state)).toBe(false)
		deleteCognitiveSession("test-knowledge-2")
	})

	test("isSameDirectionRetry — true when 2+ failures without reads", () => {
		const state = getCognitiveState("test-retry-1")
		state.consecutiveFixFailures = 2
		state.newFilesReadSinceLastFailure = 0
		expect(isSameDirectionRetry(state)).toBe(true)
		deleteCognitiveSession("test-retry-1")
	})

	test("isSameDirectionRetry — false when new files read", () => {
		const state = getCognitiveState("test-retry-2")
		state.consecutiveFixFailures = 3
		state.newFilesReadSinceLastFailure = 1
		expect(isSameDirectionRetry(state)).toBe(false)
		deleteCognitiveSession("test-retry-2")
	})
})

describe("text-matcher isFixAttempt", () => {
	test("detects fix-related text", () => {
		expect(isFixAttempt("Attempting to fix the error")).toBe(true)
		expect(isFixAttempt("修复类型错误")).toBe(true)
		expect(isFixAttempt("Let me retry this")).toBe(true)
		expect(isFixAttempt("revert the change")).toBe(true)
	})

	test("does not flag normal output", () => {
		expect(isFixAttempt("Build succeeded")).toBe(false)
		expect(isFixAttempt("All tests passed")).toBe(false)
	})
})
