import type { PluginInput } from "@opencode-ai/plugin"
import type { PhaseTrackerConfig } from "./types"
import { DEFAULT_PHASE_TRACKER_CONFIG } from "./types"
import {
	getSessionState,
	transitionPhase,
	incrementToolCall,
	incrementExecuteCall,
	incrementReadCall,
	markTaskActive,
	updateReminderTime,
	resetCycle,
	deleteSession,
} from "./state"
import {
	classifyToolPhase,
	isExecuteTool,
	isReadTool,
	isTaskCompletionCall,
	isCaptureSignalPresent,
} from "./phase-detector"
import {
	buildSkippedReadReminder,
	buildCaptureReminder,
	buildTaskCompletionNoCaptureWarning,
	buildCompactionStateCheckpoint,
	buildChatMessagePhaseStatus,
} from "./prompts"
import { log } from "../../shared"

export function createMethodologyPhaseTrackerHook(
	_ctx: PluginInput,
	configOverrides?: Partial<PhaseTrackerConfig>,
) {
	const config: PhaseTrackerConfig = {
		...DEFAULT_PHASE_TRACKER_CONFIG,
		...configOverrides,
	}

	const toolExecuteBefore = async (
		input: { tool: string; sessionID: string; callID: string },
		_output: { args: Record<string, unknown> },
	): Promise<void> => {
		const { tool, sessionID } = input
		const state = getSessionState(sessionID)

		incrementToolCall(sessionID)

		const phase = classifyToolPhase(tool)
		if (phase) {
			transitionPhase(sessionID, phase, tool)
		}

		if (isReadTool(tool)) {
			incrementReadCall(sessionID)
		}

		if (isExecuteTool(tool)) {
			incrementExecuteCall(sessionID)
		}

		if (tool.toLowerCase() === "task_create" || tool.toLowerCase() === "task") {
			markTaskActive(sessionID)
		}

		log("[methodology-phase-tracker] before", {
			tool,
			sessionID,
			phase: state.currentPhase,
			readCount: state.readCallCount,
			executeCount: state.executeCallCount,
		})
	}

	const toolExecuteAfter = async (
		input: { tool: string; sessionID: string; callID: string },
		output: { title: string; output: string; metadata: Record<string, unknown> },
	): Promise<void> => {
		const { tool, sessionID } = input
		const state = getSessionState(sessionID)
		const now = Date.now()
		const cooldownMs = config.reminderCooldownSeconds * 1000

		if (
			isExecuteTool(tool) &&
			state.readCallCount === 0 &&
			state.executeCallCount >= config.executeWithoutReadThreshold &&
			now - state.lastReminderTime > cooldownMs
		) {
			output.output += buildSkippedReadReminder(state)
			updateReminderTime(sessionID)
			log("[methodology-phase-tracker] Injected Read-skipped reminder", { sessionID })
		}

		if (
			isExecuteTool(tool) &&
			state.executeCallCount > 0 &&
			state.executeCallCount % config.captureReminderThreshold === 0 &&
			!state.completedPhases.has("capture") &&
			now - state.lastReminderTime > cooldownMs
		) {
			output.output += buildCaptureReminder(state)
			updateReminderTime(sessionID)
			log("[methodology-phase-tracker] Injected Capture reminder", { sessionID })
		}

		if (isTaskCompletionCall(tool, output.metadata)) {
			if (!state.completedPhases.has("capture") && !isCaptureSignalPresent(output.output)) {
				resetCycle(sessionID)
				throw new Error(buildTaskCompletionNoCaptureWarning())
			}
			resetCycle(sessionID)
		}
	}

	const compacting = async (
		input: { sessionID: string },
		output: { context: string[] },
	): Promise<void> => {
		const state = getSessionState(input.sessionID)
		output.context.push(buildCompactionStateCheckpoint(state))
		log("[methodology-phase-tracker] Compaction checkpoint injected", {
			sessionID: input.sessionID,
			phase: state.currentPhase,
			executeCount: state.executeCallCount,
		})
	}

	const event = async ({ event }: { event: { type: string; properties?: unknown } }): Promise<void> => {
		if (event.type !== "session.deleted") return
		const props = event.properties as { info?: { id?: string } } | undefined
		const sessionId = props?.info?.id
		if (sessionId) {
			deleteSession(sessionId)
		}
	}

	const chatMessage = async (
		input: { sessionID: string },
		output: { parts: Array<{ type: string; text?: string; [key: string]: unknown }> },
	): Promise<void> => {
		const state = getSessionState(input.sessionID)
		const statusText = buildChatMessagePhaseStatus(state)
		if (!statusText) return

		output.parts.push({ type: "text", text: statusText })
		log("[methodology-phase-tracker] Injected phase status into chat.message", {
			sessionID: input.sessionID,
			phase: state.currentPhase,
		})
	}

	return {
		"tool.execute.before": toolExecuteBefore,
		"tool.execute.after": toolExecuteAfter,
		"experimental.session.compacting": compacting,
		"chat.message": chatMessage,
		event,
	}
}


