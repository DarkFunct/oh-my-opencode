import type { PluginInput } from "@opencode-ai/plugin"
import { writeFile } from "fs/promises"
import { join } from "path"
import { log } from "../../shared"
import { getGateMetadataDir } from "../gate-metadata-path"
import type { ToolAbortEvent } from "@gaia/omo-hooks"

const ABORT_PATTERNS = [
	"tool execution aborted",
	"execution was aborted",
	"operation was aborted",
	"command was aborted",
	"timed out",
	"execution timed out",
]

const TOOL_ABORT_EVENTS_FILENAME = "tool-abort-events.json"

const CONTINUATION_MESSAGE =
	"\n\n[SYSTEM] 工具执行被中断。请检查当前活跃任务状态，继续执行当前任务。不要停止工作。"

function isAbortOutput(text: string): boolean {
	const lower = text.toLowerCase()
	return ABORT_PATTERNS.some((pattern) => lower.includes(pattern))
}

export function createToolAbortRecoveryHook(_ctx: PluginInput) {
	const consecutiveAbortMap = new Map<string, number>()

	async function writeAbortEvent(sessionID: string, toolName: string, reason: string): Promise<void> {
		try {
			const key = sessionID
			const count = (consecutiveAbortMap.get(key) ?? 0) + 1
			consecutiveAbortMap.set(key, count)

			const event: ToolAbortEvent = {
				toolName,
				reason,
				timestamp: new Date().toISOString(),
				consecutiveCount: count,
			}
			const dir = getGateMetadataDir(sessionID)
			const filePath = join(dir, TOOL_ABORT_EVENTS_FILENAME)

			let existing: ToolAbortEvent[] = []
			try {
				const { readFile } = await import("fs/promises")
				const raw = await readFile(filePath, "utf-8")
				existing = JSON.parse(raw) as ToolAbortEvent[]
			} catch {
				/* first event */
			}

			existing.push(event)
			await writeFile(filePath, JSON.stringify(existing, null, 2), "utf-8")
		} catch (err) {
			log("[tool-abort-recovery] Failed to write abort event", { sessionID, toolName, error: err })
		}
	}

	const toolExecuteAfter = async (
		input: { tool: string; sessionID: string; callID: string },
		output: { title: string; output: string; metadata: Record<string, unknown> } | undefined,
	): Promise<void> => {
		if (!output) return

		const text = output.output
		if (!text || typeof text !== "string") return
		if (!isAbortOutput(text)) return

		log("[tool-abort-recovery] Detected abort in tool output", {
			tool: input.tool,
			sessionID: input.sessionID,
			callID: input.callID,
			outputSnippet: text.slice(0, 120),
		})

		await writeAbortEvent(input.sessionID, input.tool, text.slice(0, 200))

		output.output = text + CONTINUATION_MESSAGE
	}

	return {
		"tool.execute.after": toolExecuteAfter,
	}
}
