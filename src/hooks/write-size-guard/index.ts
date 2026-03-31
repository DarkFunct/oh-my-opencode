import type { PluginInput } from "@opencode-ai/plugin"
import { log } from "../../shared"
import { GATE_PROMPT } from "../../config/gate-prompts"

export interface WriteSizeGuardConfig {
	maxLines: number
	enabled: boolean
}

const DEFAULT_CONFIG: WriteSizeGuardConfig = {
	maxLines: 200,
	enabled: true,
}

const WRITE_TOOLS = new Set(["write", "writefile", "write_file"])

function countLines(content: string): number {
	if (!content) return 0
	return content.split("\n").length
}

export function createWriteSizeGuardHook(
	_ctx: PluginInput,
	configOverrides?: Partial<WriteSizeGuardConfig>,
) {
	const config: WriteSizeGuardConfig = { ...DEFAULT_CONFIG, ...configOverrides }

	const toolExecuteBefore = async (
		input: { tool: string; sessionID: string; callID: string },
		output: { args: Record<string, unknown> },
	): Promise<void> => {
		if (!config.enabled) return

		const normalized = input.tool.toLowerCase()
		if (!WRITE_TOOLS.has(normalized)) return

		const content = output.args.content
		if (typeof content !== "string") return

		const lineCount = countLines(content)
		if (lineCount <= config.maxLines) return

		log("[write-size-guard] Write blocked — content exceeds max lines", {
			tool: input.tool,
			sessionID: input.sessionID,
			lineCount,
			maxLines: config.maxLines,
		})

		throw new Error(GATE_PROMPT.writeSizeBlock(lineCount, config.maxLines))
	}

	return {
		"tool.execute.before": toolExecuteBefore,
	}
}
