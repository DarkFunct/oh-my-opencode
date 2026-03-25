import type { PluginInput } from "@opencode-ai/plugin"
import { log } from "../../shared"

const BATCH_THRESHOLD = 5

const BATCH_SIGNAL_PATTERNS = [
	/(\d+)\s*(?:个|项|条|件|files?|items?|entries?|objects?)/i,
	/(?:批量|batch|bulk|all|every)\s/i,
	/(?:所有|全部|每个|each)\s/i,
]

function extractBatchCount(argsString: string): number | null {
	const match = argsString.match(/(\d+)\s*(?:个|项|条|件|files?|items?|entries?|objects?)/i)
	if (match) {
		const count = parseInt(match[1], 10)
		return Number.isFinite(count) ? count : null
	}
	return null
}

function hasBatchSignal(argsString: string): boolean {
	return BATCH_SIGNAL_PATTERNS.some(p => p.test(argsString))
}

export function createBatchClassificationGuardHook(_ctx: PluginInput) {
	const sessionWarned = new Map<string, number>()

	const toolExecuteBefore = async (
		input: { tool: string; sessionID: string; callID: string },
		output: { args: Record<string, unknown> },
	): Promise<void> => {
		let batchCount: number | null = null
		let isBatchSignal = false

		try {
			const { tool, sessionID } = input
			const normalized = tool.toLowerCase()

			if (normalized !== "task" && normalized !== "bash") return

			const safeArgs = output?.args ?? {}
			const argsString = JSON.stringify(safeArgs)

			batchCount = extractBatchCount(argsString)
			isBatchSignal = hasBatchSignal(argsString)

			if (!isBatchSignal && (batchCount === null || batchCount < BATCH_THRESHOLD)) return

			const lastWarned = sessionWarned.get(sessionID) ?? 0
			if (Date.now() - lastWarned < 120_000) return

			sessionWarned.set(sessionID, Date.now())

			log("[batch-classification-guard] Batch operation detected", {
				sessionID,
				tool,
				batchCount,
				isBatchSignal,
			})
		} catch (e) {
			log("[gaia-hook-safe] batch-classification-guard toolExecuteBefore failed", { error: e })
			return
		}

		throw new Error(
			[
				"[Batch Classification Guard] 批量操作检测",
				"",
				`检测到可能涉及 ${batchCount ?? "多个"} 对象的批量操作。`,
				"",
				"Harness 要求：对 >5 个对象的批量操作，必须先分类再执行：",
				"1. 按类型/优先级/风险级别对对象分类",
				"2. 确认每个分类的处理策略",
				"3. 然后按分类分批执行",
				"",
				"请先完成分类，然后重新执行。此拦截每 2 分钟最多触发一次。",
			].join("\n"),
		)
	}

	const event = async ({ event }: { event: { type: string; properties?: unknown } }): Promise<void> => {
		if (event.type !== "session.deleted") return
		const props = event.properties as { info?: { id?: string } } | undefined
		const sessionId = props?.info?.id
		if (sessionId) {
			sessionWarned.delete(sessionId)
		}
	}

	return {
		"tool.execute.before": toolExecuteBefore,
		event,
	}
}
