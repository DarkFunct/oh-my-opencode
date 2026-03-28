import type { PluginInput } from "@opencode-ai/plugin"
import type { Message, Part } from "@opencode-ai/sdk"
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
	isCaptureToolCall,
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
import { log, isReadOnlyBashCommand, isVerificationBashCommand } from "../../shared"

type MessageWithParts = {
	info: Message
	parts: Part[]
}

type MessagesTransformOutput = { messages: MessageWithParts[] }

const MAX_STATUS_LENGTH = 400

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
		try {
			const { tool, sessionID } = input
			const state = getSessionState(sessionID)

			incrementToolCall(sessionID)

			const toolLower = tool.toLowerCase()
			const isBashNonWrite =
				(toolLower === "bash" || toolLower === "interactive_bash") &&
				(() => {
					const cmd = typeof _output.args.command === "string" ? _output.args.command : ""
					return isReadOnlyBashCommand(cmd) || isVerificationBashCommand(cmd)
				})()

			const phase = isBashNonWrite ? "read" : classifyToolPhase(tool)
			if (phase) {
				transitionPhase(sessionID, phase, tool)
			}

			if (isCaptureToolCall(tool, _output.args)) {
				transitionPhase(sessionID, "capture", tool)
			}

			if (isReadTool(tool) || isBashNonWrite) {
				incrementReadCall(sessionID)
			}

			if (isExecuteTool(tool) && !isBashNonWrite) {
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
		} catch (e) {
			log("[gaia-hook-safe] methodologyPhaseTracker before failed", { error: e })
		}
	}

	const toolExecuteAfter = async (
		input: { tool: string; sessionID: string; callID: string },
		output: { title: string; output: string; metadata: Record<string, unknown> },
	): Promise<void> => {
		try {
			if (!output) return
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
				output.output = (output.output ?? "") + buildSkippedReadReminder(state)
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
				output.output = (output.output ?? "") + buildCaptureReminder(state)
				updateReminderTime(sessionID)
				log("[methodology-phase-tracker] Injected Capture reminder", { sessionID })
			}

			if (isTaskCompletionCall(tool, output.metadata ?? {})) {
				if (!state.completedPhases.has("capture") && !isCaptureSignalPresent(output.output ?? "")) {
					output.output = (output.output ?? "") + buildTaskCompletionNoCaptureWarning()
					log("[methodology-phase-tracker] Task completion without Capture — warning injected", { sessionID })
				}
				resetCycle(sessionID)
			}
		} catch (e) {
			log("[gaia-hook-safe] methodologyPhaseTracker after failed", { error: e })
		}
	}

	const compacting = async (
		input: { sessionID: string },
		output: { context: string[] },
	): Promise<void> => {
		try {
			if (!output?.context || !Array.isArray(output.context)) return
			const state = getSessionState(input.sessionID)
			output.context.push(buildCompactionStateCheckpoint(state))
			log("[methodology-phase-tracker] Compaction checkpoint injected", {
				sessionID: input.sessionID,
				phase: state.currentPhase,
				executeCount: state.executeCallCount,
			})
		} catch (e) {
			log("[gaia-hook-safe] methodologyPhaseTracker compacting failed", { error: e })
		}
	}

	const messagesTransform = async (
		_input: Record<string, never>,
		output: MessagesTransformOutput,
	): Promise<void> => {
		try {
			const sessionID = extractSessionID(output.messages)
			if (!sessionID) return

			const state = getSessionState(sessionID)
			const statusText = buildChatMessagePhaseStatus(state)
			if (!statusText) return

			const truncated = statusText.length > MAX_STATUS_LENGTH
				? statusText.slice(0, MAX_STATUS_LENGTH) + "\n..."
				: statusText

			const lastUser = output.messages.findLast((m) => m.info.role === "user")
			if (!lastUser) return

			const textIdx = lastUser.parts.findIndex(
				(p) => p.type === "text" && (p as { text?: string }).text,
			)
			if (textIdx === -1) return

			lastUser.parts.splice(textIdx, 0, {
				id: `methodology_phase_${sessionID}`,
				messageID: lastUser.info.id,
				sessionID: (lastUser.info as { sessionID?: string }).sessionID ?? "",
				type: "text",
				text: truncated,
				synthetic: true,
			} as Part)

			log("[methodology-phase-tracker] Injected phase status via messages.transform", {
				sessionID,
				phase: state.currentPhase,
			})
		} catch (e) {
			log("[gaia-hook-safe] methodologyPhaseTracker messagesTransform failed", { error: e })
		}
	}

	const event = async ({ event }: { event: { type: string; properties?: unknown } }): Promise<void> => {
		if (event.type !== "session.deleted") return
		const props = event.properties as { info?: { id?: string } } | undefined
		const sessionId = props?.info?.id
		if (sessionId) {
			deleteSession(sessionId)
		}
	}

	return {
		"tool.execute.before": toolExecuteBefore,
		"tool.execute.after": toolExecuteAfter,
		"experimental.session.compacting": compacting,
		"experimental.chat.messages.transform": messagesTransform,
		event,
	}
}

function extractSessionID(messages: MessageWithParts[]): string | undefined {
	for (let i = messages.length - 1; i >= 0; i--) {
		const sid = (messages[i].info as { sessionID?: string }).sessionID
		if (sid) return sid
	}
	return undefined
}
