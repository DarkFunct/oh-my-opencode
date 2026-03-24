import type { PluginInput } from "@opencode-ai/plugin"
import type { GovernanceConfig } from "./types"
import { DEFAULT_GOVERNANCE_CONFIG } from "./types"
import { createToolExecuteBeforeHandler } from "./handlers/tool-execute-before"
import { createToolExecuteAfterHandler } from "./handlers/tool-execute-after"
import { createChatMessageHandler } from "./handlers/chat-message"
import { createPreCompactHandler } from "./handlers/pre-compact"

export function createBehavioralGovernanceHook(
	_ctx: PluginInput,
	configOverrides?: Partial<GovernanceConfig>,
) {
	const config: GovernanceConfig = {
		...DEFAULT_GOVERNANCE_CONFIG,
		...configOverrides,
	}

	return {
		"tool.execute.before": createToolExecuteBeforeHandler(config),
		"tool.execute.after": createToolExecuteAfterHandler(config),
		"chat.message": createChatMessageHandler(),
		"experimental.session.compacting": createPreCompactHandler(),
	}
}
