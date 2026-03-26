import type { PluginInput } from "@opencode-ai/plugin"
import type { Message, Part } from "@opencode-ai/sdk"
import type { TaskLifecycleConfig } from "./types"
import { DEFAULT_TASK_LIFECYCLE_CONFIG } from "./types"
import {
	getSessionState,
	markTaskCreated,
	markTaskCompleted,
	incrementEditWrite,
	updateReminderTime,
	deleteSession,
} from "./state"
import { buildNoTaskCreatedReminder, buildCompactionCheckpoint, buildChatMessageTaskStatus } from "./prompts"
import { extractTaskId, parseTaskOutput } from "./task-output-parser"
import { log } from "../../shared"

type MessageWithParts = {
	info: Message
	parts: Part[]
}

type MessagesTransformOutput = { messages: MessageWithParts[] }

const EDIT_WRITE_TOOLS = new Set(["edit", "write", "bash", "interactive_bash", "ast_grep_replace"])
const TASK_CREATE_TOOLS = new Set(["task_create"])
const TASK_UPDATE_TOOLS = new Set(["task_update"])

const MAX_STATUS_LENGTH = 400

export function createTaskLifecycleEnforcerHook(
	_ctx: PluginInput,
	configOverrides?: Partial<TaskLifecycleConfig>,
) {
	const config: TaskLifecycleConfig = {
		...DEFAULT_TASK_LIFECYCLE_CONFIG,
		...configOverrides,
	}

	const toolExecuteAfter = async (
		input: { tool: string; sessionID: string; callID: string },
		output: { title: string; output: string; metadata: Record<string, unknown> },
	): Promise<void> => {
		try {
			if (!output) return
			const { tool, sessionID } = input
			const normalized = tool.toLowerCase()
			const state = getSessionState(sessionID)

			if (TASK_CREATE_TOOLS.has(normalized)) {
				const taskId = extractTaskId(output.output)
				markTaskCreated(sessionID, taskId)
				log("[task-lifecycle-enforcer] Task created", { sessionID, taskId })
				return
			}

			if (TASK_UPDATE_TOOLS.has(normalized)) {
				const parsed = parseTaskOutput(output.output)
				if (parsed.status === "completed") {
					markTaskCompleted(sessionID, parsed.id)
					log("[task-lifecycle-enforcer] Task completed", { sessionID, taskId: parsed.id })
				} else if (parsed.status === "in_progress" && parsed.id) {
					markTaskCreated(sessionID, parsed.id)
				}
				return
			}

			if (EDIT_WRITE_TOOLS.has(normalized)) {
				incrementEditWrite(sessionID)

				const now = Date.now()
				const cooldownMs = config.reminderCooldownSeconds * 1000

				if (
					!state.hasCreatedTask &&
					state.editWriteCallCount >= config.editWriteBeforeTaskReminder &&
					now - state.lastReminderTime > cooldownMs
				) {
					output.output = (output.output ?? "") + buildNoTaskCreatedReminder(state)
					updateReminderTime(sessionID)
					log("[task-lifecycle-enforcer] Injected no-task reminder", {
						sessionID,
						editWriteCount: state.editWriteCallCount,
					})
				}
			}
		} catch (e) {
			log("[gaia-hook-safe] taskLifecycleEnforcer after failed", { error: e })
		}
	}

	const compacting = async (
		input: { sessionID: string },
		output: { context: string[] },
	): Promise<void> => {
		try {
			if (!output?.context || !Array.isArray(output.context)) return
			const state = getSessionState(input.sessionID)
			output.context.push(buildCompactionCheckpoint(state))
			log("[task-lifecycle-enforcer] Compaction checkpoint injected", {
				sessionID: input.sessionID,
			})
		} catch (e) {
			log("[gaia-hook-safe] taskLifecycleEnforcer compacting failed", { error: e })
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
			const statusText = buildChatMessageTaskStatus(state)
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
				id: `task_lifecycle_${sessionID}`,
				messageID: lastUser.info.id,
				sessionID: (lastUser.info as { sessionID?: string }).sessionID ?? "",
				type: "text",
				text: truncated,
				synthetic: true,
			} as Part)

			log("[task-lifecycle-enforcer] Injected task status via messages.transform", {
				sessionID,
			})
		} catch (e) {
			log("[gaia-hook-safe] taskLifecycleEnforcer messagesTransform failed", { error: e })
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
