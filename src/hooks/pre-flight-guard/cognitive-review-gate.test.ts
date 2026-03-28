import { randomUUID } from "node:crypto"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import type { PluginInput } from "@opencode-ai/plugin"
import { subagentSessions } from "../../features/claude-code-session-state"
import {
	_resetCognitiveReviewVerdictForTesting,
	setCognitiveReviewVerdict,
} from "../cognitive-governance-shared/review-state"
import { createPreFlightGuardHook } from "./index"

describe("pre-flight cognitive review gate", () => {
	beforeEach(() => {
		subagentSessions.clear()
		_resetCognitiveReviewVerdictForTesting()
	})

	afterEach(() => {
		subagentSessions.clear()
		_resetCognitiveReviewVerdictForTesting()
	})

	test("blocks execute when verdict is pending", async () => {
		const sessionID = `ses_pending_${randomUUID()}`
		subagentSessions.add(sessionID)
		setCognitiveReviewVerdict(sessionID, {
			conclusion: "pending",
			stage: "A",
			layer: "understanding",
			dimensions: ["technical", "engineering"],
			confidence: 0.65,
			reasons: ["execution intent detected without verification plan"],
			risk: "medium",
			source: "gaia-stage-a",
		})

		const hook = createPreFlightGuardHook(
			{ directory: join(tmpdir(), `preflight-cog-${randomUUID()}`) } as PluginInput,
			{ minReadBeforeExecute: 0 },
		)

		const before = hook["tool.execute.before"]
		if (!before) throw new Error("tool.execute.before hook missing")

		await expect(
			before(
				{ tool: "edit", sessionID, callID: "call-pending" },
				{ args: { filePath: "src/main.ts" } },
			),
		).rejects.toThrow("[Cognitive Review Gate]")
	})

	test("blocks execute when verdict is fail", async () => {
		const sessionID = `ses_fail_${randomUUID()}`
		subagentSessions.add(sessionID)
		setCognitiveReviewVerdict(sessionID, {
			conclusion: "fail",
			stage: "A",
			layer: "perception",
			dimensions: ["technical"],
			confidence: 0.8,
			reasons: ["execution intent detected without evidence binding"],
			risk: "high",
			source: "gaia-stage-a",
		})

		const hook = createPreFlightGuardHook(
			{ directory: join(tmpdir(), `preflight-cog-${randomUUID()}`) } as PluginInput,
			{ minReadBeforeExecute: 0 },
		)

		const before = hook["tool.execute.before"]
		if (!before) throw new Error("tool.execute.before hook missing")

		await expect(
			before(
				{ tool: "write", sessionID, callID: "call-fail" },
				{ args: { filePath: "src/main.ts", content: "x" } },
			),
		).rejects.toThrow("[Cognitive Review Gate]")
	})

	test("allows execute when verdict is pass", async () => {
		const sessionID = `ses_pass_${randomUUID()}`
		subagentSessions.add(sessionID)
		setCognitiveReviewVerdict(sessionID, {
			conclusion: "pass",
			stage: "A",
			layer: "rationality",
			dimensions: ["technical", "empirical", "theoretical", "engineering", "philosophical"],
			confidence: 0.9,
			reasons: [],
			risk: "low",
			source: "gaia-stage-a",
		})

		const hook = createPreFlightGuardHook(
			{ directory: join(tmpdir(), `preflight-cog-${randomUUID()}`) } as PluginInput,
			{ minReadBeforeExecute: 0 },
		)

		const before = hook["tool.execute.before"]
		if (!before) throw new Error("tool.execute.before hook missing")

		await expect(
			before(
				{ tool: "edit", sessionID, callID: "call-pass" },
				{ args: { filePath: "src/main.ts" } },
			),
		).resolves.toBeUndefined()
	})

	test("blocks execute when stage-b verdict is fail", async () => {
		const sessionID = `ses_stage_b_fail_${randomUUID()}`
		subagentSessions.add(sessionID)
		setCognitiveReviewVerdict(sessionID, {
			conclusion: "fail",
			stage: "B",
			layer: "understanding",
			dimensions: ["technical", "theoretical"],
			confidence: 0.78,
			reasons: ["causal chain incomplete"],
			risk: "high",
			source: "llm-stage-b",
		})

		const hook = createPreFlightGuardHook(
			{ directory: join(tmpdir(), `preflight-cog-${randomUUID()}`) } as PluginInput,
			{ minReadBeforeExecute: 0 },
		)

		const before = hook["tool.execute.before"]
		if (!before) throw new Error("tool.execute.before hook missing")

		await expect(
			before(
				{ tool: "edit", sessionID, callID: "call-stage-b-fail" },
				{ args: { filePath: "src/main.ts" } },
			),
		).rejects.toThrow("[Cognitive Review Gate]")
	})
})
