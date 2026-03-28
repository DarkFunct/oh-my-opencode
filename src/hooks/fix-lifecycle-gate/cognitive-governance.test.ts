import { describe, expect, test } from "bun:test"
import { getCognitiveState, deleteCognitiveSession, hasCognitiveSession } from "../cognitive-governance-shared/state"
import { isCaptureSettled, recordCaptureWrite } from "../cognitive-governance-shared/capture-cooldown"
import { assessCognition, determineCognitiveLayer } from "../cognitive-governance/conversation-analyzer"
import { detectRepeatFix, incrementConsecutiveFailure } from "./repeat-fix-detector"
import { detectCaptureViolation } from "./capture-gate"
import { detectCognitiveFailureBlock } from "./failure-gate"
import { detectCognitiveFailureWarn } from "../cognitive-governance/failure-directives"
import { DEFAULT_FIX_LIFECYCLE_GATE_CONFIG } from "./config"

describe("cognitive-governance-shared/state", () => {
	test("creates default state on first access", () => {
		const state = getCognitiveState("test-session-state")
		expect(state.detectedErrors).toEqual([])
		expect(state.currentLayer).toBe("perception")
		expect(state.fixAttempts).toBe(0)
		expect(state.consecutiveFixFailures).toBe(0)
		expect(state.roundCounter).toBe(0)
		deleteCognitiveSession("test-session-state")
	})

	test("returns same state for same session", () => {
		const s1 = getCognitiveState("test-same-session")
		const s2 = getCognitiveState("test-same-session")
		expect(s1).toBe(s2)
		deleteCognitiveSession("test-same-session")
	})

	test("deletes session", () => {
		getCognitiveState("test-delete")
		expect(hasCognitiveSession("test-delete")).toBe(true)
		deleteCognitiveSession("test-delete")
		expect(hasCognitiveSession("test-delete")).toBe(false)
	})
})

describe("capture-cooldown", () => {
	test("not settled when no writes", () => {
		const state = getCognitiveState("test-cooldown-1")
		expect(isCaptureSettled(state)).toBe(false)
		deleteCognitiveSession("test-cooldown-1")
	})

	test("not settled when write is recent", () => {
		const state = getCognitiveState("test-cooldown-2")
		state.roundCounter = 5
		recordCaptureWrite(state, "_meta/knowledge/pitfalls.md")
		expect(state.captureWriteCount).toBe(1)
		expect(state.captureLastWriteRound).toBe(5)
		expect(isCaptureSettled(state)).toBe(false)
		deleteCognitiveSession("test-cooldown-2")
	})

	test("settled after 3 rounds since last write", () => {
		const state = getCognitiveState("test-cooldown-3")
		state.roundCounter = 5
		recordCaptureWrite(state, "_meta/knowledge/pitfalls.md")
		state.roundCounter = 8
		expect(isCaptureSettled(state)).toBe(true)
		deleteCognitiveSession("test-cooldown-3")
	})
})

describe("repeat-fix-detector", () => {
	test("no block when under threshold", () => {
		const state = getCognitiveState("test-repeat-1")
		state.consecutiveFixFailures = 2
		const verdict = detectRepeatFix(state)
		expect(verdict.shouldBlock).toBe(false)
		deleteCognitiveSession("test-repeat-1")
	})

	test("blocks at 3 consecutive failures", () => {
		const state = getCognitiveState("test-repeat-2")
		state.consecutiveFixFailures = 3
		const verdict = detectRepeatFix(state)
		expect(verdict.shouldBlock).toBe(true)
		expect(verdict.reason).toBe("consecutive_failures")
		deleteCognitiveSession("test-repeat-2")
	})

	test("respects configurable repeat fix threshold", () => {
		const state = getCognitiveState("test-repeat-config-1")
		state.consecutiveFixFailures = 3
		const verdict = detectRepeatFix(state, {
			...DEFAULT_FIX_LIFECYCLE_GATE_CONFIG,
			repeatFixThreshold: 4,
		})
		expect(verdict.shouldBlock).toBe(false)
		deleteCognitiveSession("test-repeat-config-1")
	})

	test("blocks same file repeated edits with unresolved errors", () => {
		const state = getCognitiveState("test-repeat-3")
		state.lastFixTarget = "/src/foo.ts"
		state.fileEditHistory.set("/src/foo.ts", {
			count: 2,
			lastEditTimestamp: Date.now(),
			tools: ["edit"],
		})
		state.detectedErrors.push({
			pattern: "compilation",
			rawMessage: "error TS2345",
			tool: "bash",
			timestamp: Date.now() - 1000,
			filePath: "/src/foo.ts",
		})
		const verdict = detectRepeatFix(state)
		expect(verdict.shouldBlock).toBe(true)
		expect(verdict.reason).toBe("same_file_repeated")
		deleteCognitiveSession("test-repeat-3")
	})

	test("does not block same file edits without errors", () => {
		const state = getCognitiveState("test-repeat-4")
		state.lastFixTarget = "/src/foo.ts"
		state.fileEditHistory.set("/src/foo.ts", {
			count: 5,
			lastEditTimestamp: Date.now(),
			tools: ["edit"],
		})
		const verdict = detectRepeatFix(state)
		expect(verdict.shouldBlock).toBe(false)
		deleteCognitiveSession("test-repeat-4")
	})

	test("incrementConsecutiveFailure increments counter", () => {
		const state = getCognitiveState("test-repeat-5")
		expect(state.consecutiveFixFailures).toBe(0)
		incrementConsecutiveFailure(state)
		expect(state.consecutiveFixFailures).toBe(1)
		incrementConsecutiveFailure(state)
		expect(state.consecutiveFixFailures).toBe(2)
		deleteCognitiveSession("test-repeat-5")
	})
})

describe("capture-gate", () => {
	test("no block when not in execute phase", () => {
		const state = getCognitiveState("test-capture-1")
		state.executePhaseActive = false
		const verdict = detectCaptureViolation(state)
		expect(verdict.shouldBlock).toBe(false)
		deleteCognitiveSession("test-capture-1")
	})

	test("no block when few edits", () => {
		const state = getCognitiveState("test-capture-2")
		state.executePhaseActive = true
		state.fileEditHistory.set("a.ts", { count: 1, lastEditTimestamp: Date.now(), tools: ["edit"] })
		const verdict = detectCaptureViolation(state)
		expect(verdict.shouldBlock).toBe(false)
		deleteCognitiveSession("test-capture-2")
	})

	test("blocks when capture overdue (≥4 rounds)", () => {
		const state = getCognitiveState("test-capture-3")
		state.executePhaseActive = true
		state.roundsSinceCaptureNeeded = 4
		state.fileEditHistory.set("a.ts", { count: 1, lastEditTimestamp: Date.now(), tools: ["edit"] })
		state.fileEditHistory.set("b.ts", { count: 1, lastEditTimestamp: Date.now(), tools: ["edit"] })
		state.fileEditHistory.set("c.ts", { count: 1, lastEditTimestamp: Date.now(), tools: ["edit"] })
		const verdict = detectCaptureViolation(state)
		expect(verdict.shouldBlock).toBe(true)
		expect(verdict.reason).toBe("capture_overdue")
		deleteCognitiveSession("test-capture-3")
	})

	test("respects configurable capture hard block threshold", () => {
		const state = getCognitiveState("test-capture-config-1")
		state.executePhaseActive = true
		state.roundsSinceCaptureNeeded = 4
		state.fileEditHistory.set("a.ts", { count: 1, lastEditTimestamp: Date.now(), tools: ["edit"] })
		state.fileEditHistory.set("b.ts", { count: 1, lastEditTimestamp: Date.now(), tools: ["edit"] })
		state.fileEditHistory.set("c.ts", { count: 1, lastEditTimestamp: Date.now(), tools: ["edit"] })
		const verdict = detectCaptureViolation(state, {
			...DEFAULT_FIX_LIFECYCLE_GATE_CONFIG,
			captureHardBlockThreshold: 5,
		})
		expect(verdict.shouldBlock).toBe(false)
		deleteCognitiveSession("test-capture-config-1")
	})

	test("no block when capture is settled", () => {
		const state = getCognitiveState("test-capture-4")
		state.executePhaseActive = true
		state.roundsSinceCaptureNeeded = 10
		state.roundCounter = 15
		state.captureWriteCount = 1
		state.captureLastWriteRound = 12
		state.fileEditHistory.set("a.ts", { count: 1, lastEditTimestamp: Date.now(), tools: ["edit"] })
		state.fileEditHistory.set("b.ts", { count: 1, lastEditTimestamp: Date.now(), tools: ["edit"] })
		state.fileEditHistory.set("c.ts", { count: 1, lastEditTimestamp: Date.now(), tools: ["edit"] })
		const verdict = detectCaptureViolation(state)
		expect(verdict.shouldBlock).toBe(false)
		deleteCognitiveSession("test-capture-4")
	})
})

describe("failure-gate (F1/F3/F5)", () => {
	test("F1: blocks blind execution — errors detected but source not read", () => {
		const state = getCognitiveState("test-f1-1")
		state.executePhaseActive = true
		state.detectedErrors.push({
			pattern: "compilation",
			rawMessage: "error TS2345",
			tool: "bash",
			timestamp: Date.now(),
			filePath: "/src/broken.ts",
		})
		const failure = detectCognitiveFailureBlock(state)
		expect(failure).not.toBeNull()
		expect(failure!.id).toBe("F1")
		expect(failure!.directive).toContain("F1")
		deleteCognitiveSession("test-f1-1")
	})

	test("no F1 when error source files have been read", () => {
		const state = getCognitiveState("test-f1-2")
		state.executePhaseActive = true
		state.detectedErrors.push({
			pattern: "compilation",
			rawMessage: "error TS2345",
			tool: "bash",
			timestamp: Date.now(),
			filePath: "/src/broken.ts",
		})
		state.readFiles.add("/src/broken.ts")
		const failure = detectCognitiveFailureBlock(state)
		expect(failure).toBeNull()
		deleteCognitiveSession("test-f1-2")
	})

	test("F3: no block when edits below threshold", () => {
		const state = getCognitiveState("test-f3-1")
		state.editsSinceLastVerification = 4
		const failure = detectCognitiveFailureBlock(state)
		expect(failure).toBeNull()
		deleteCognitiveSession("test-f3-1")
	})

	test("F3: blocks at 5+ edits without verification", () => {
		const state = getCognitiveState("test-f3-2")
		state.editsSinceLastVerification = 5
		const failure = detectCognitiveFailureBlock(state)
		expect(failure).not.toBeNull()
		expect(failure!.id).toBe("F3")
		expect(failure!.name).toBe("Unverified Changes")
		expect(failure!.action).toBe("block")
		expect(failure!.directive).toContain("F3")
		expect(failure!.directive).toContain("5")
		deleteCognitiveSession("test-f3-2")
	})

	test("F3 threshold is configurable", () => {
		const state = getCognitiveState("test-f3-config-1")
		state.editsSinceLastVerification = 5
		const failure = detectCognitiveFailureBlock(state, {
			...DEFAULT_FIX_LIFECYCLE_GATE_CONFIG,
			f3BlockThreshold: 6,
		})
		expect(failure).toBeNull()
		deleteCognitiveSession("test-f3-config-1")
	})

	test("F3: blocks at higher edit counts", () => {
		const state = getCognitiveState("test-f3-3")
		state.editsSinceLastVerification = 10
		const failure = detectCognitiveFailureBlock(state)
		expect(failure).not.toBeNull()
		expect(failure!.id).toBe("F3")
		expect(failure!.directive).toContain("10")
		deleteCognitiveSession("test-f3-3")
	})

	test("F5: blocks same direction retry — 2+ failures with no new reads", () => {
		const state = getCognitiveState("test-f5-1")
		state.consecutiveFixFailures = 2
		state.newFilesReadSinceLastFailure = 0
		const failure = detectCognitiveFailureBlock(state)
		expect(failure).not.toBeNull()
		expect(failure!.id).toBe("F5")
		expect(failure!.directive).toContain("F5")
		deleteCognitiveSession("test-f5-1")
	})

	test("no F5 when new files have been read", () => {
		const state = getCognitiveState("test-f5-2")
		state.consecutiveFixFailures = 3
		state.newFilesReadSinceLastFailure = 1
		const failure = detectCognitiveFailureBlock(state)
		expect(failure).toBeNull()
		deleteCognitiveSession("test-f5-2")
	})

	test("F1 takes priority over F3", () => {
		const state = getCognitiveState("test-priority-1")
		state.executePhaseActive = true
		state.detectedErrors.push({
			pattern: "compilation",
			rawMessage: "error TS2345",
			tool: "bash",
			timestamp: Date.now(),
			filePath: "/src/broken.ts",
		})
		state.editsSinceLastVerification = 10
		const failure = detectCognitiveFailureBlock(state)
		expect(failure).not.toBeNull()
		expect(failure!.id).toBe("F1")
		deleteCognitiveSession("test-priority-1")
	})

	test("F3 takes priority over F5", () => {
		const state = getCognitiveState("test-priority-2")
		state.editsSinceLastVerification = 7
		state.consecutiveFixFailures = 3
		state.newFilesReadSinceLastFailure = 0
		const failure = detectCognitiveFailureBlock(state)
		expect(failure).not.toBeNull()
		expect(failure!.id).toBe("F3")
		deleteCognitiveSession("test-priority-2")
	})
})

describe("determineCognitiveLayer", () => {
	test("perception when read count < 2", () => {
		const state = getCognitiveState("test-layer-1")
		state.readCount = 1
		expect(determineCognitiveLayer(state)).toBe("perception")
		deleteCognitiveSession("test-layer-1")
	})

	test("perception when dimensions < 2", () => {
		const state = getCognitiveState("test-layer-2")
		state.readCount = 5
		state.dimensionsCovered.add("technical")
		expect(determineCognitiveLayer(state)).toBe("perception")
		deleteCognitiveSession("test-layer-2")
	})

	test("understanding when reading done but no edits", () => {
		const state = getCognitiveState("test-layer-3")
		state.readCount = 10
		state.dimensionsCovered.add("technical")
		state.dimensionsCovered.add("empirical")
		expect(determineCognitiveLayer(state)).toBe("understanding")
		deleteCognitiveSession("test-layer-3")
	})

	test("understanding when editing but no verification", () => {
		const state = getCognitiveState("test-layer-4")
		state.readCount = 10
		state.dimensionsCovered.add("technical")
		state.dimensionsCovered.add("empirical")
		state.fileEditHistory.set("foo.ts", { count: 1, lastEditTimestamp: Date.now(), tools: ["edit"] })
		expect(determineCognitiveLayer(state)).toBe("understanding")
		deleteCognitiveSession("test-layer-4")
	})

	test("rationality when editing with verification", () => {
		const state = getCognitiveState("test-layer-5")
		state.readCount = 10
		state.dimensionsCovered.add("technical")
		state.dimensionsCovered.add("empirical")
		state.fileEditHistory.set("foo.ts", { count: 1, lastEditTimestamp: Date.now(), tools: ["edit"] })
		state.lastBuildResult = "success"
		expect(determineCognitiveLayer(state)).toBe("rationality")
		deleteCognitiveSession("test-layer-5")
	})
})

describe("assessCognition", () => {
	test("captures dimension gaps", () => {
		const state = getCognitiveState("test-assess-1")
		state.dimensionsCovered.add("technical")
		state.dimensionsCovered.add("empirical")
		const assessment = assessCognition(state)
		expect(assessment.dimensionsCovered).toContain("technical")
		expect(assessment.dimensionsCovered).toContain("empirical")
		expect(assessment.dimensionsGap).toContain("theoretical")
		expect(assessment.dimensionsGap).toContain("engineering")
		expect(assessment.dimensionsGap).toContain("philosophical")
		deleteCognitiveSession("test-assess-1")
	})

	test("detects capture urgency escalation", () => {
		const state = getCognitiveState("test-assess-2")
		state.executePhaseActive = true
		state.fileEditHistory.set("a.ts", { count: 1, lastEditTimestamp: Date.now(), tools: ["edit"] })
		state.fileEditHistory.set("b.ts", { count: 1, lastEditTimestamp: Date.now(), tools: ["edit"] })
		state.fileEditHistory.set("c.ts", { count: 1, lastEditTimestamp: Date.now(), tools: ["edit"] })

		state.roundsSinceCaptureNeeded = 0
		let a = assessCognition(state)
		expect(a.captureNeeded).toBe(true)
		expect(a.captureUrgency).toBe("reminder")

		state.roundsSinceCaptureNeeded = 2
		a = assessCognition(state)
		expect(a.captureUrgency).toBe("warning")

		state.roundsSinceCaptureNeeded = 3
		a = assessCognition(state)
		expect(a.captureUrgency).toBe("critical")
		deleteCognitiveSession("test-assess-2")
	})

	test("capture not needed when settled", () => {
		const state = getCognitiveState("test-assess-3")
		state.executePhaseActive = true
		state.captureWriteCount = 1
		state.captureLastWriteRound = 5
		state.roundCounter = 8
		state.fileEditHistory.set("a.ts", { count: 1, lastEditTimestamp: Date.now(), tools: ["edit"] })
		state.fileEditHistory.set("b.ts", { count: 1, lastEditTimestamp: Date.now(), tools: ["edit"] })
		state.fileEditHistory.set("c.ts", { count: 1, lastEditTimestamp: Date.now(), tools: ["edit"] })
		const a = assessCognition(state)
		expect(a.captureNeeded).toBe(false)
		expect(a.captureUrgency).toBe("none")
		deleteCognitiveSession("test-assess-3")
	})
})

describe("failure-directives (F2/F3-warn/F4)", () => {
	test("F2: warns when editing files unrelated to error source", () => {
		const state = getCognitiveState("test-f2-warn-1")
		state.detectedErrors.push({
			pattern: "compilation",
			rawMessage: "error TS2345",
			tool: "bash",
			timestamp: Date.now(),
			filePath: "/src/error-source.ts",
		})
		state.fileEditHistory.set("/src/unrelated.ts", { count: 1, lastEditTimestamp: Date.now(), tools: ["edit"] })
		const warn = detectCognitiveFailureWarn(state)
		expect(warn).not.toBeNull()
		expect(warn).toContain("F2")
		expect(warn).toContain("error-source.ts")
		expect(warn).toContain("unrelated.ts")
		deleteCognitiveSession("test-f2-warn-1")
	})

	test("no F2 when edited files overlap with error source", () => {
		const state = getCognitiveState("test-f2-warn-2")
		state.detectedErrors.push({
			pattern: "compilation",
			rawMessage: "error TS2345",
			tool: "bash",
			timestamp: Date.now(),
			filePath: "/src/error-source.ts",
		})
		state.fileEditHistory.set("/src/error-source.ts", { count: 1, lastEditTimestamp: Date.now(), tools: ["edit"] })
		const warn = detectCognitiveFailureWarn(state)
		expect(warn).toBeNull()
		deleteCognitiveSession("test-f2-warn-2")
	})

	test("F3 warn: triggers at 4+ edits without verification", () => {
		const state = getCognitiveState("test-f3-warn-1")
		state.editsSinceLastVerification = 4
		const warn = detectCognitiveFailureWarn(state)
		expect(warn).not.toBeNull()
		expect(warn).toContain("F3")
		expect(warn).toContain("4")
		deleteCognitiveSession("test-f3-warn-1")
	})

	test("no F3 warn below threshold", () => {
		const state = getCognitiveState("test-f3-warn-2")
		state.editsSinceLastVerification = 3
		const warn = detectCognitiveFailureWarn(state)
		expect(warn).toBeNull()
		deleteCognitiveSession("test-f3-warn-2")
	})

	test("F4: warns when in execute phase without reading knowledge files", () => {
		const state = getCognitiveState("test-f4-warn-1")
		state.executePhaseActive = true
		const warn = detectCognitiveFailureWarn(state)
		expect(warn).not.toBeNull()
		expect(warn).toContain("F4")
		expect(warn).toContain("知识库")
		deleteCognitiveSession("test-f4-warn-1")
	})

	test("no F4 when knowledge files have been read", () => {
		const state = getCognitiveState("test-f4-warn-2")
		state.executePhaseActive = true
		state.readFiles.add("_meta/knowledge/pitfalls.md")
		const warn = detectCognitiveFailureWarn(state)
		expect(warn).toBeNull()
		deleteCognitiveSession("test-f4-warn-2")
	})

	test("no F4 when not in execute phase", () => {
		const state = getCognitiveState("test-f4-warn-3")
		state.executePhaseActive = false
		const warn = detectCognitiveFailureWarn(state)
		expect(warn).toBeNull()
		deleteCognitiveSession("test-f4-warn-3")
	})

	test("F2 takes priority over F3 warn and F4", () => {
		const state = getCognitiveState("test-warn-priority")
		state.executePhaseActive = true
		state.editsSinceLastVerification = 6
		state.detectedErrors.push({
			pattern: "compilation",
			rawMessage: "error TS2345",
			tool: "bash",
			timestamp: Date.now(),
			filePath: "/src/error-source.ts",
		})
		state.fileEditHistory.set("/src/unrelated.ts", { count: 1, lastEditTimestamp: Date.now(), tools: ["edit"] })
		const warn = detectCognitiveFailureWarn(state)
		expect(warn).not.toBeNull()
		expect(warn).toContain("F2")
		deleteCognitiveSession("test-warn-priority")
	})
})
