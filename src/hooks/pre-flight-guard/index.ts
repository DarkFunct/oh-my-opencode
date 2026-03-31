import type { PluginInput } from "@opencode-ai/plugin"
import type { PreFlightConfig } from "./types"
import { DEFAULT_PRE_FLIGHT_CONFIG } from "./types"
import { getSessionState, incrementRead, incrementPlan, markBlocked, resetCycle, deleteSession } from "./state"
import { getSessionAgent } from "../../features/claude-code-session-state"
import { isReadOnlyBashCommand } from "../../shared/bash-command-classifier"
import { isSubagentSession } from "../../shared/task-ownership-policy"
import {
	getCognitiveReviewVerdict,
	clearCognitiveReviewVerdict,
} from "../cognitive-governance-shared/review-state"
import {
	buildCognitiveReviewBlockMessage,
	shouldBlockByCognitiveReview,
} from "./cognitive-review-gate"
import { log } from "../../shared"
import { runRuntimeGovernancePrecheck } from "../shared/governance-runtime-precheck"
import { runGovernanceBootGate } from "../shared/governance-boot-gate"
import {
	clearGovernanceSessionValidation,
} from "../shared/governance-session-state"
import { GATE_PROMPT } from "../../config/gate-prompts"

const READ_TOOLS = new Set([
	"read", "glob", "grep", "ast_grep_search",
	"lsp_goto_definition", "lsp_find_references", "lsp_symbols", "lsp_diagnostics",
	"webfetch", "look_at", "skill",
])

const PLAN_TOOLS = new Set(["task_create", "task_list", "task_get", "question"])

const EXECUTE_TOOLS = new Set(["edit", "write", "bash", "interactive_bash", "ast_grep_replace", "lsp_rename"])

export function createPreFlightGuardHook(
	_ctx: PluginInput,
	configOverrides?: Partial<PreFlightConfig>,
) {
	const config: PreFlightConfig = {
		...DEFAULT_PRE_FLIGHT_CONFIG,
		...configOverrides,
	}

	const toolExecuteBefore = async (
		input: { tool: string; sessionID: string; callID: string },
		_output: { args: Record<string, unknown> },
	): Promise<void> => {
		const { tool, sessionID } = input
		const normalized = tool.toLowerCase()
		let governanceBlockMessage: string | null = null

		try {
			const state = getSessionState(sessionID)

			if (READ_TOOLS.has(normalized)) {
				incrementRead(sessionID)
				if (state.firstExecuteBlocked && state.readToolCount >= config.minReadBeforeExecute) {
					resetCycle(sessionID)
					log("[pre-flight-guard] Cycle re-armed — sufficient reads after block", {
						sessionID,
					})
				}
				return
			}

			if (PLAN_TOOLS.has(normalized) || normalized === "task") {
				incrementPlan(sessionID)
				return
			}

			if (!EXECUTE_TOOLS.has(normalized)) return

			if (normalized === "bash") {
				const command = typeof _output.args.command === "string" ? _output.args.command : ""
				if (isReadOnlyBashCommand(command)) {
					incrementRead(sessionID)
					return
				}
			}

			const reviewVerdict = getCognitiveReviewVerdict(sessionID)
			if (!governanceBlockMessage && shouldBlockByCognitiveReview(reviewVerdict)) {
				governanceBlockMessage = buildCognitiveReviewBlockMessage(reviewVerdict)
			}

			if (!isSubagentSession(sessionID)) {
				const bootGate = await runGovernanceBootGate({
					directory: _ctx.directory,
					sessionID,
				})

				if (bootGate.status === "failed") {
					governanceBlockMessage = bootGate.message ?? GATE_PROMPT.governanceBootFailure("Startup governance check returned failure status")
				}
			}

			if (!isSubagentSession(sessionID) && !governanceBlockMessage) {
				const runtimePrecheck = await runRuntimeGovernancePrecheck({
					directory: _ctx.directory,
					sessionID,
					agent: getSessionAgent(sessionID),
					tool: normalized,
					args: _output.args,
				})

				if (runtimePrecheck.status === "failed") {
					governanceBlockMessage = runtimePrecheck.message
				}
			}

			if (!governanceBlockMessage) {
				if (state.readToolCount >= config.minReadBeforeExecute) return

				if (state.firstExecuteBlocked) return

				markBlocked(sessionID)
				log("[pre-flight-guard] Execute without Read detected", {
					sessionID,
					tool,
					readCount: state.readToolCount,
				})
			}
		} catch (e) {
			log("[gaia-hook-safe] preFlightGuard before failed", { error: e })
			return
		}

		if (governanceBlockMessage) {
			throw new Error(governanceBlockMessage)
		}

		throw new Error(GATE_PROMPT.preFlightReadBlock())
	}

	const event = async ({ event }: { event: { type: string; properties?: unknown } }): Promise<void> => {
		if (event.type === "session.created") {
			const props = event.properties as { info?: { id?: string } } | undefined
			const sessionId = props?.info?.id
			if (sessionId && !isSubagentSession(sessionId)) {
				await runGovernanceBootGate({
					directory: _ctx.directory,
					sessionID: sessionId,
				})
			}
			return
		}

		if (event.type !== "session.deleted") return
		const props = event.properties as { info?: { id?: string } } | undefined
		const sessionId = props?.info?.id
		if (sessionId) {
			deleteSession(sessionId)
			clearCognitiveReviewVerdict(sessionId)
			clearGovernanceSessionValidation(sessionId)
		}
	}

	return {
		"tool.execute.before": toolExecuteBefore,
		event,
	}
}
