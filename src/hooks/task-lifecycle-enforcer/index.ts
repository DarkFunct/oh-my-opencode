import type { PluginInput } from "@opencode-ai/plugin"
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
import { log } from "../../shared"

const EDIT_WRITE_TOOLS = new Set(["edit", "write", "bash", "interactive_bash", "ast_grep_replace"])
const TASK_CREATE_TOOLS = new Set(["task_create"])
const TASK_UPDATE_TOOLS = new Set(["task_update"])

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
		const { tool, sessionID } = input
		const normalized = tool.toLowerCase()
		const state = getSessionState(sessionID)

		if (TASK_CREATE_TOOLS.has(normalized)) {
			const taskId = typeof output.metadata?.id === "string" ? output.metadata.id : undefined
			markTaskCreated(sessionID, taskId)
			log("[task-lifecycle-enforcer] Task created", { sessionID, taskId })
			return
		}

		if (normalized === "task" && typeof output.metadata?.action === "string") {
			if (output.metadata.action === "create") {
				const taskId = typeof output.metadata?.id === "string" ? output.metadata.id : undefined
				markTaskCreated(sessionID, taskId)
			}
		}

		if (TASK_UPDATE_TOOLS.has(normalized)) {
			if (output.metadata?.status === "completed") {
				const taskId = typeof output.metadata?.id === "string" ? output.metadata.id : undefined
				markTaskCompleted(sessionID, taskId)
				log("[task-lifecycle-enforcer] Task completed", { sessionID, taskId })
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
	}

	const compacting = async (
		input: { sessionID: string },
		output: { context: string[] },
	): Promise<void> => {
		const state = getSessionState(input.sessionID)
		output.context.push(buildCompactionCheckpoint(state))
		log("[task-lifecycle-enforcer] Compaction checkpoint injected", {
			sessionID: input.sessionID,
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
		const statusText = buildChatMessageTaskStatus(state)
		if (!statusText) return

		output.parts.push({ type: "text", text: statusText })
		log("[task-lifecycle-enforcer] Injected task status into chat.message", {
			sessionID: input.sessionID,
		})
	}

	return {
		"tool.execute.after": toolExecuteAfter,
		"experimental.session.compacting": compacting,
		"chat.message": chatMessage,
		event,
	}
}
