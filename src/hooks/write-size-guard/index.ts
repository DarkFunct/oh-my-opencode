import type { PluginInput } from "@opencode-ai/plugin"
import { log } from "../../shared"

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

		throw new Error(
			[
				"[🛑 Write Size Guard] 写入内容超出行数限制",
				"",
				`当前行数: ${lineCount}，最大允许: ${config.maxLines}`,
				"",
				"必须执行分段写入策略:",
				"1. 将内容拆分为多个 < " + config.maxLines + " 行的片段",
				"2. 第一次使用 Write 写入文件基础部分",
				"3. 后续使用 Edit 追加剩余内容",
				"4. 每次操作后验证文件完整性",
			].join("\n"),
		)
	}

	return {
		"tool.execute.before": toolExecuteBefore,
	}
}
