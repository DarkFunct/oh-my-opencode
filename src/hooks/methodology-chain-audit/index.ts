import type { PluginInput } from "@opencode-ai/plugin"
import { detectChainSignals } from "./signal-detector"
import { log } from "../../shared"

const CHAIN_AUDIT_WARNING_PREFIX = "\n\n[⚠️ 方法论链信号审计]"

const EXEMPT_AGENTS = new Set(["explore", "librarian", "oracle", "metis", "momus"])

const MIN_OUTPUT_LENGTH_FOR_AUDIT = 100

function getAgentFromMetadata(metadata: Record<string, unknown> | undefined): string | undefined {
  if (!metadata) return undefined
  const agent = metadata.agent ?? metadata.agentName ?? metadata.agent_name
  return typeof agent === "string" ? agent.toLowerCase() : undefined
}

export function createMethodologyChainAuditHook(_ctx: PluginInput) {
  return {
    "tool.execute.after": async (
      input: { tool: string; sessionID: string; callID: string },
      output: { title: string; output: string; metadata: Record<string, unknown> }
    ) => {
      if (input.tool !== "Task" && input.tool !== "task") return

      // Skip background task launches — output is launch metadata, not actual subagent result
      if (output.metadata?.sync === false || output.metadata?.run_in_background === true) {
        log("[methodology-chain-audit] Background launch, skipping", { sessionID: input.sessionID })
        return
      }

      const responseText = output.output?.trim() ?? ""
      if (responseText.length < MIN_OUTPUT_LENGTH_FOR_AUDIT) return

      const agent = getAgentFromMetadata(output.metadata)
      if (agent && EXEMPT_AGENTS.has(agent)) {
        log("[methodology-chain-audit] Exempt agent, skipping", { agent })
        return
      }

      const result = detectChainSignals(responseText)

      log("[methodology-chain-audit] Signal detection result", {
        sessionID: input.sessionID,
        agent,
        readDetected: result.readDetected,
        planDetected: result.planDetected,
        captureDetected: result.captureDetected,
        missingCount: result.missingSignals.length,
      })

      if (result.missingSignals.length === 0) return

      const warning = [
        CHAIN_AUDIT_WARNING_PREFIX,
        `子 Agent 输出中未检测到以下方法论链信号：`,
        ...result.missingSignals.map(s => `  - ${s}`),
        ``,
        `请根据 M4 验收协议检查：`,
        `  1. 以上信号是否确实缺失（误报可忽略）`,
        `  2. 如确实缺失，通过 session_id 退回并携带诊断信息`,
        `  3. 退回时说明：缺失环节 + 期望内容 + 实际收到`,
      ].join("\n")

      output.output = `${output.output}${warning}`
    },
  }
}
