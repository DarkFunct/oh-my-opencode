import type { PluginInput } from "@opencode-ai/plugin"
import { log } from "../../shared"

interface RetroState {
	consecutiveFixAttempts: number
	lastFixTool: string | null
	taskCompletionCount: number
	lastRetrospectiveTime: number
}

const sessions = new Map<string, RetroState>()
const RETRO_COOLDOWN_MS = 300_000

const FIX_SIGNAL_PATTERNS = [
	/(?:fix|修复|修正|revert|回退|rollback|undo)/i,
	/(?:retry|重试|再试|again)/i,
]

function getState(sessionID: string): RetroState {
	let state = sessions.get(sessionID)
	if (!state) {
		state = {
			consecutiveFixAttempts: 0,
			lastFixTool: null,
			taskCompletionCount: 0,
			lastRetrospectiveTime: 0,
		}
		sessions.set(sessionID, state)
	}
	return state
}

function isFixAttempt(output: string): boolean {
	return FIX_SIGNAL_PATTERNS.some(p => p.test(output))
}

export function createRetrospectiveTriggerHook(_ctx: PluginInput) {
	const toolExecuteAfter = async (
		input: { tool: string; sessionID: string; callID: string },
		output: { title: string; output: string; metadata: Record<string, unknown> },
	): Promise<void> => {
		const { tool, sessionID } = input
		const normalized = tool.toLowerCase()
		const state = getState(sessionID)

		if ((normalized === "edit" || normalized === "write" || normalized === "bash") &&
			isFixAttempt(output.output)) {
			state.consecutiveFixAttempts++
			state.lastFixTool = tool
		} else if (normalized === "edit" || normalized === "write" || normalized === "bash") {
			state.consecutiveFixAttempts = 0
		}

		if (normalized === "task_update" && output.metadata?.status === "completed") {
			state.taskCompletionCount++
		}

		const now = Date.now()
		const shouldTrigger =
			state.consecutiveFixAttempts >= 3 &&
			now - state.lastRetrospectiveTime > RETRO_COOLDOWN_MS

		if (shouldTrigger) {
			state.lastRetrospectiveTime = now
			state.consecutiveFixAttempts = 0

			output.output += [
				"\n\n[🔄 过程复盘触发]",
				`检测到连续 ${state.consecutiveFixAttempts + 3} 次修正尝试。`,
				"",
				"Harness 要求触发过程复盘：",
				"1. 回顾最近的修正链 — 根因是什么？",
				"2. 是否在修复症状而非根因？",
				"3. 是否需要回退到已知良好状态重新开始？",
				"4. 记录教训到 _meta/knowledge/lessons-learned.md",
			].join("\n")

			log("[retrospective-trigger] Triggered retrospective", {
				sessionID,
				fixAttempts: state.consecutiveFixAttempts + 3,
			})
		}
	}

	const event = async ({ event }: { event: { type: string; properties?: unknown } }): Promise<void> => {
		if (event.type !== "session.deleted") return
		const props = event.properties as { info?: { id?: string } } | undefined
		const sessionId = props?.info?.id
		if (sessionId) {
			sessions.delete(sessionId)
		}
	}

	return {
		"tool.execute.after": toolExecuteAfter,
		event,
	}
}
