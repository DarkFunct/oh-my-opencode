import type { PluginInput } from "@opencode-ai/plugin"
import { getCognitiveState, deleteCognitiveSession } from "../cognitive-governance-shared/state"
import { extractFilePath } from "../session-evidence-collector/error-detector"
import { isExecuteTool } from "../session-evidence-collector/evidence-signals"
import { detectRepeatFix, incrementConsecutiveFailure } from "./repeat-fix-detector"
import { buildBlockMessage } from "./prompts"
import { log } from "../../shared"

export function createFixLifecycleGateHook(_ctx: PluginInput) {
	const toolExecuteBefore = async (
		input: { tool: string; sessionID: string; callID: string },
		output: { args: Record<string, unknown> },
	): Promise<void> => {
		const { tool, sessionID } = input
		const normalized = tool.toLowerCase()

		if (!isExecuteTool(normalized)) return

		try {
			const state = getCognitiveState(sessionID)
			const filePath = extractFilePath(normalized, output.args)

			if (filePath && state.lastFixTarget === filePath) {
				incrementConsecutiveFailure(state)
			}

			const verdict = detectRepeatFix(state)

			if (verdict.shouldBlock) {
				log("[fix-lifecycle-gate] Blocking repeat fix", {
					sessionID,
					tool,
					reason: verdict.reason,
					fixCount: verdict.fixCount,
					target: verdict.target,
				})
				throw new Error(buildBlockMessage(verdict))
			}
		} catch (e) {
			if (e instanceof Error && e.message.startsWith("[🛑")) {
				throw e
			}
			log("[gaia-hook-safe] fixLifecycleGate before failed", { error: e })
		}
	}

	const event = async ({ event }: { event: { type: string; properties?: unknown } }): Promise<void> => {
		if (event.type !== "session.deleted") return
		const props = event.properties as { info?: { id?: string } } | undefined
		const sessionId = props?.info?.id
		if (sessionId) {
			deleteCognitiveSession(sessionId)
		}
	}

	return {
		"tool.execute.before": toolExecuteBefore,
		event,
	}
}
