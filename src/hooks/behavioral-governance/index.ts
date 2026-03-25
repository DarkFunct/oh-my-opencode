import type { PluginInput } from "@opencode-ai/plugin"
import type { GovernanceConfig } from "./types"
import { DEFAULT_GOVERNANCE_CONFIG } from "./types"
import { createToolExecuteBeforeHandler } from "./handlers/tool-execute-before"
import { createToolExecuteAfterHandler } from "./handlers/tool-execute-after"
import { createChatMessageHandler } from "./handlers/chat-message"
import { createPreCompactHandler } from "./handlers/pre-compact"
import { deleteSession } from "./state"

export function createBehavioralGovernanceHook(
	_ctx: PluginInput,
	configOverrides?: Partial<GovernanceConfig>,
) {
	const config: GovernanceConfig = {
		...DEFAULT_GOVERNANCE_CONFIG,
		...configOverrides,
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
		"tool.execute.before": createToolExecuteBeforeHandler(config),
		"tool.execute.after": createToolExecuteAfterHandler(config),
		"chat.message": createChatMessageHandler(),
		"experimental.session.compacting": createPreCompactHandler(),
		event,
	}
}
