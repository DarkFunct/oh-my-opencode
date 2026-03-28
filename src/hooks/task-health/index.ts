import type { PluginInput } from "@opencode-ai/plugin"
import type { Message, Part } from "@opencode-ai/sdk"
import { existsSync, readdirSync } from "fs"
import { join } from "path"
import { isSubagentSession } from "../../shared/task-ownership-policy"
import { log } from "../../shared/logger"
import { getTaskDir, readJsonSafe } from "../../features/claude-tasks/storage"
import { TaskObjectSchema } from "../../tools/task/types"
import type { TaskObject } from "../../tools/task/types"
import { upsertEntry, markDetached, flushIfDirty, loadIndex } from "../../shared/task-health"
import { markCollected } from "../../shared/task-health/background-status-bridge"
import { scanAllTasks } from "../../shared/task-health/anomaly-detector"
import { buildHealthSummaryTag, buildCompactionSnapshot } from "./prompts"
import { syncTaskLeaseSignal } from "../task-lifecycle-enforcer/lease-sync"

type MessageWithParts = { info: Message; parts: Part[] }
type MessagesTransformOutput = { messages: MessageWithParts[] }

const TASK_TOOLS = new Set(["task_create", "task_update"])
const BG_OUTPUT_TOOL = "background_output"
const MAX_SUMMARY_LENGTH = 600

function loadOpenTasks(config: Record<string, unknown>): TaskObject[] {
  const taskDir = getTaskDir(config)
  if (!existsSync(taskDir)) return []

  const files = readdirSync(taskDir).filter((f) => f.endsWith(".json") && f.startsWith("T-"))
  const tasks: TaskObject[] = []

  for (const file of files) {
    const task = readJsonSafe(join(taskDir, file), TaskObjectSchema)
    if (task && task.status !== "completed" && task.status !== "deleted") {
      tasks.push(task)
    }
  }

  return tasks
}

function extractSessionID(messages: MessageWithParts[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const sid = (messages[i].info as { sessionID?: string }).sessionID
    if (sid) return sid
  }
  return undefined
}

export function createTaskHealthHook(ctx: PluginInput) {
  const config = {} as Record<string, unknown>

  const toolExecuteAfter = async (
    input: { tool: string; sessionID: string; callID: string },
    output: { title: string; output: string; metadata: Record<string, unknown> },
  ): Promise<void> => {
    try {
      if (!output) return
      const { tool, sessionID } = input
      if (isSubagentSession(sessionID)) return

      const normalized = tool.toLowerCase()

      if (normalized === BG_OUTPUT_TOOL) {
        const bgTaskIdMatch = output.output?.match(/"task_id"\s*:\s*"([^"]+)"/)
          ?? output.output?.match(/"id"\s*:\s*"(bg_[^"]+)"/)
        if (bgTaskIdMatch) {
          markCollected(bgTaskIdMatch[1])
          await syncTaskLeaseSignal({
            directory: ctx.directory,
            sessionID,
            action: "heartbeat",
          })
          log("[task-health] bg task marked collected", { taskId: bgTaskIdMatch[1] })
        }
        return
      }

      if (!TASK_TOOLS.has(normalized)) return

      const now = Date.now()
      const taskIdMatch = output.output?.match(/"id"\s*:\s*"(T-[^"]+)"/)
      if (!taskIdMatch) return

      const taskId = taskIdMatch[1]
      upsertEntry(taskId, {
        lastTaskToolAt: now,
        originSessionID: sessionID,
        originSessionType: "main",
      }, config)

      log("[task-health] sidecar updated via tool.execute.after", { tool: normalized, taskId })
    } catch (e) {
      log("[gaia-hook-safe] taskHealth after failed", { error: e })
    }
  }

  const messagesTransform = async (
    _input: Record<string, never>,
    output: MessagesTransformOutput,
  ): Promise<void> => {
    try {
      const sessionID = extractSessionID(output.messages)
      if (!sessionID) return
      if (isSubagentSession(sessionID)) return

      loadIndex(config)
      const tasks = loadOpenTasks(config)
      if (tasks.length === 0) return

      const report = scanAllTasks(tasks, { config })
      if (report.anomalies.length === 0) return

      const summaryTag = buildHealthSummaryTag(report)
      if (!summaryTag) return

      const truncated = summaryTag.length > MAX_SUMMARY_LENGTH
        ? summaryTag.slice(0, MAX_SUMMARY_LENGTH) + "\n...</task-health>"
        : summaryTag

      const lastUser = output.messages.findLast((m) => m.info.role === "user")
      if (!lastUser) return

      const textIdx = lastUser.parts.findIndex(
        (p) => p.type === "text" && (p as { text?: string }).text,
      )
      if (textIdx === -1) return

      lastUser.parts.splice(textIdx, 0, {
        id: `task_health_${sessionID}`,
        messageID: lastUser.info.id,
        sessionID: (lastUser.info as { sessionID?: string }).sessionID ?? "",
        type: "text",
        text: truncated,
        synthetic: true,
      } as Part)

      log("[task-health] injected health summary", {
        sessionID,
        anomalyCount: report.anomalies.length,
      })
    } catch (e) {
      log("[gaia-hook-safe] taskHealth messagesTransform failed", { error: e })
    }
  }

  const compacting = async (
    input: { sessionID: string },
    output: { context: string[] },
  ): Promise<void> => {
    try {
      if (!output?.context || !Array.isArray(output.context)) return

      loadIndex(config)
      const tasks = loadOpenTasks(config)
      const report = scanAllTasks(tasks, { config })
      output.context.push(buildCompactionSnapshot(report))

      flushIfDirty(config)
      log("[task-health] compaction snapshot injected", { sessionID: input.sessionID })
    } catch (e) {
      log("[gaia-hook-safe] taskHealth compacting failed", { error: e })
    }
  }

  const event = async ({ event: ev }: { event: { type: string; properties?: unknown } }): Promise<void> => {
    if (ev.type !== "session.deleted") return

    try {
      const props = ev.properties as { info?: { id?: string } } | undefined
      const sessionId = props?.info?.id
      if (!sessionId) return

      const updated = markDetached(sessionId, config)
      if (updated > 0) {
        flushIfDirty(config)
        log("[task-health] session deleted, marked detached", { sessionId, updated })
      }
    } catch (e) {
      log("[gaia-hook-safe] taskHealth event failed", { error: e })
    }
  }

  return {
    "tool.execute.after": toolExecuteAfter,
    "experimental.chat.messages.transform": messagesTransform,
    "experimental.session.compacting": compacting,
    event,
  }
}
