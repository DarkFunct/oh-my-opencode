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
import { extractTaskId, parseTaskOutput } from "./task-output-parser"
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
		try {
			if (!output?.parts || !Array.isArray(output.parts)) return
			const state = getSessionState(input.sessionID)
			const statusText = buildChatMessageTaskStatus(state)
			if (!statusText) return

			const lastTextPart = output.parts.findLast((p) => p.type === "text" && typeof p.text === "string")
			if (lastTextPart) {
				lastTextPart.text = `${lastTextPart.text}\n\n${String(statusText)}`
			}
			log("[task-lifecycle-enforcer] Injected task status into chat.message", {
				sessionID: input.sessionID,
			})
		} catch (e) {
			log("[gaia-hook-safe] taskLifecycleEnforcer chatMessage failed", { error: e })
		}
	}

	return {
		"tool.execute.after": toolExecuteAfter,
		"experimental.session.compacting": compacting,
		"chat.message": chatMessage,
		event,
	}
}
