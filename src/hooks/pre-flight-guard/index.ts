import type { PluginInput } from "@opencode-ai/plugin"
import type { PreFlightConfig } from "./types"
import { DEFAULT_PRE_FLIGHT_CONFIG } from "./types"
import { getSessionState, incrementRead, incrementPlan, markBlocked, resetCycle, deleteSession } from "./state"
import { isReadOnlyBashCommand } from "../../shared/bash-command-classifier"
import { log } from "../../shared"

const READ_TOOLS = new Set([
	"read", "glob", "grep", "ast_grep_search",
	"lsp_goto_definition", "lsp_find_references", "lsp_symbols", "lsp_diagnostics",
	"webfetch", "look_at", "skill",
])

const PLAN_TOOLS = new Set(["task_create", "task_list", "task_get", "question"])

const EXECUTE_TOOLS = new Set(["edit", "write", "bash", "interactive_bash", "ast_grep_replace", "lsp_rename"])

export function createPreFlightGuardHook(
	_ctx: PluginInput,
	configOverrides?: Partial<PreFlightConfig>,
) {
	const config: PreFlightConfig = {
		...DEFAULT_PRE_FLIGHT_CONFIG,
		...configOverrides,
	}

	const toolExecuteBefore = async (
		input: { tool: string; sessionID: string; callID: string },
		_output: { args: Record<string, unknown> },
	): Promise<void> => {
		const { tool, sessionID } = input
		const normalized = tool.toLowerCase()

		try {
			const state = getSessionState(sessionID)

			if (READ_TOOLS.has(normalized)) {
				incrementRead(sessionID)
				if (state.firstExecuteBlocked && state.readToolCount >= config.minReadBeforeExecute) {
					resetCycle(sessionID)
					log("[pre-flight-guard] Cycle re-armed — sufficient reads after block", {
						sessionID,
					})
				}
				return
			}

			if (PLAN_TOOLS.has(normalized) || normalized === "task") {
				incrementPlan(sessionID)
				return
			}

			if (!EXECUTE_TOOLS.has(normalized)) return

			if (normalized === "bash") {
				const command = typeof _output.args.command === "string" ? _output.args.command : ""
				if (isReadOnlyBashCommand(command)) {
					incrementRead(sessionID)
					return
				}
			}

			if (state.readToolCount >= config.minReadBeforeExecute) return

			if (state.firstExecuteBlocked) return

			markBlocked(sessionID)
			log("[pre-flight-guard] Execute without Read detected", {
				sessionID,
				tool,
				readCount: state.readToolCount,
			})
		} catch (e) {
			log("[gaia-hook-safe] preFlightGuard before failed", { error: e })
			return
		}

		throw new Error(
			[
				"[Pre-flight Guard] 执行操作被拦截",
				"",
				"检测到直接执行修改操作，但尚未完成 Read 阶段。",
				"方法论链要求：Read(阅读) → Plan(方案) → Execute(执行)",
				"",
				"在修改代码前，请先：",
				"1. 使用 Read/Glob/Grep/LSP 工具阅读相关文件",
				"2. 理解当前代码状态和上下文",
				"3. 制定修改方案",
				"4. 然后再执行修改",
				"",
				"此拦截仅触发一次，后续操作不会重复阻断。",
			].join("\n"),
		)
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
		"tool.execute.before": toolExecuteBefore,
		event,
	}
}
