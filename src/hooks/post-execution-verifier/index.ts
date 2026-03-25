import type { PluginInput } from "@opencode-ai/plugin"
import type { PostExecutionConfig } from "./types"
import { DEFAULT_POST_EXECUTION_CONFIG } from "./types"
import {
	getSessionState,
	incrementStep,
	addModifiedFile,
	incrementBash,
	updateReminderTime,
	deleteSession,
} from "./state"
import { buildStepVerificationReminder, buildCompletionAuditReminder } from "./prompts"
import { log } from "../../shared"

const EXECUTE_TOOLS = new Set(["edit", "write", "bash", "interactive_bash", "ast_grep_replace", "lsp_rename"])

function extractFilePath(args: Record<string, unknown>): string | undefined {
	if (typeof args.filePath === "string") return args.filePath
	if (typeof args.file_path === "string") return args.file_path
	if (typeof args.path === "string") return args.path
	return undefined
}

export function createPostExecutionVerifierHook(
	_ctx: PluginInput,
	configOverrides?: Partial<PostExecutionConfig>,
) {
	const config: PostExecutionConfig = {
		...DEFAULT_POST_EXECUTION_CONFIG,
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

			if (!EXECUTE_TOOLS.has(normalized)) {
				if (normalized === "task_update" && output.metadata?.status === "completed") {
					const state = getSessionState(sessionID)
					if (state.executeStepCount > 0) {
						output.output = (output.output ?? "") + buildCompletionAuditReminder(state)
						log("[post-execution-verifier] Injected completion audit", { sessionID })
					}
				}
				return
			}

			incrementStep(sessionID)

			if (normalized === "bash" || normalized === "interactive_bash") {
				incrementBash(sessionID)
			}

			const filePath = extractFilePath(output.metadata ?? {})
			if (filePath) {
				addModifiedFile(sessionID, filePath)
			}

			const state = getSessionState(sessionID)
			const now = Date.now()
			const cooldownMs = config.reminderCooldownSeconds * 1000

			if (
				state.executeStepCount > 0 &&
				state.executeStepCount % config.verificationReminderInterval === 0 &&
				now - state.lastVerificationReminder > cooldownMs
			) {
				output.output = (output.output ?? "") + buildStepVerificationReminder(state)
				updateReminderTime(sessionID)
				log("[post-execution-verifier] Injected PRM verification reminder", {
					sessionID,
					stepCount: state.executeStepCount,
				})
			}
		} catch (e) {
			log("[gaia-hook-safe] postExecutionVerifier after failed", { error: e })
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
		event,
	}
}
