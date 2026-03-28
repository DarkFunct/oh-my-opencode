import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { existsSync, readdirSync } from "fs"
import { join } from "path"
import type { OhMyOpenCodeConfig } from "../../config/schema"
import { TaskObjectSchema } from "./types"
import type { TaskObject } from "./types"
import { getTaskDir, readJsonSafe } from "../../features/claude-tasks/storage"
import { loadIndex } from "../../shared/task-health"
import { scanAllTasks, formatSummary } from "../../shared/task-health/anomaly-detector"
import { getGlobalSummary } from "../../shared/task-health/background-status-bridge"
import { buildDispatchSummary } from "./task-dispatch-graph"
import {
  buildActionPlan,
  buildGovernanceOverview,
  buildRecommendedActions,
} from "./task-health-action-plan"
import { buildProgressOverview } from "./task-health-progress"
import { buildP1DodStatus } from "./task-health-p1-dod"

interface BackgroundManagerLike {
  getTasksByParentSession(sessionID: string): { id: string; status: string; parentSessionID: string; startedAt?: Date; completedAt?: Date }[]
  getRunningTasks(): { id: string; status: string; parentSessionID: string; startedAt?: Date; completedAt?: Date }[]
  getNonRunningTasks(): { id: string; status: string; parentSessionID: string; startedAt?: Date; completedAt?: Date }[]
  getTask(id: string): { id: string; status: string; parentSessionID: string; startedAt?: Date; completedAt?: Date } | undefined
}

function loadAllTasks(config: Partial<OhMyOpenCodeConfig>): TaskObject[] {
  const taskDir = getTaskDir(config)
  if (!existsSync(taskDir)) return []

  const files = readdirSync(taskDir).filter((f) => f.endsWith(".json") && f.startsWith("T-"))
  const tasks: TaskObject[] = []

  for (const file of files) {
    const task = readJsonSafe(join(taskDir, file), TaskObjectSchema)
    if (task) {
      tasks.push(task)
    }
  }

  return tasks
}

function loadAllOpenTasks(tasks: TaskObject[]): TaskObject[] {
  return tasks.filter((task) => task.status !== "completed" && task.status !== "deleted")
}

function buildDispatchNodes(openTasks: TaskObject[], allTaskMap: Map<string, TaskObject>): Array<{ id: string; blockedBy: string[] }> {
  return openTasks.map((task) => {
    const unresolvedBlockers = task.blockedBy.filter((blockerId) => {
      const blockerTask = allTaskMap.get(blockerId)
      return !blockerTask || blockerTask.status !== "completed"
    })

    return {
      id: task.id,
      blockedBy: unresolvedBlockers,
    }
  })
}

export function createTaskHealthTool(
  config: Partial<OhMyOpenCodeConfig>,
  backgroundManager?: BackgroundManagerLike,
): ToolDefinition {
  return tool({
    description: `Get task system health diagnostics.

Returns: active task count, anomaly summary (stale/orphan/burst/deadlock), background task status, and recommended actions.
Includes governanceOverview (risk level + prioritized action counts), progressOverview (24h trend), and p1DodStatus (phase-1 acceptance metrics).
Read-only — does not modify any state.`,
    args: {},
    execute: async (): Promise<string> => {
      try {
        loadIndex(config)
        const allTasks = loadAllTasks(config)
        const tasks = loadAllOpenTasks(allTasks)
        const allTaskMap = new Map(allTasks.map((task) => [task.id, task]))

        const deadlockDetectionStartedAt = Date.now()
        const dispatch = buildDispatchSummary(buildDispatchNodes(tasks, allTaskMap))
        const deadlockDetectionMs = Date.now() - deadlockDetectionStartedAt
        const deadlockSlaTargetMs = 10_000
        const deadlockWithinSla = deadlockDetectionMs <= deadlockSlaTargetMs

        const report = scanAllTasks(tasks, { config })
        const summary = formatSummary(report)
        const recommendedActions = buildRecommendedActions(report.anomalies, dispatch.cycleDetected)
        const actionPlan = buildActionPlan(report.anomalies, dispatch.cycleDetected)
        const governanceOverview = buildGovernanceOverview(report.anomalies, actionPlan, deadlockWithinSla)
        const progressOverview = buildProgressOverview(allTasks)
        const p1DodStatus = buildP1DodStatus({
          anomalies: report.anomalies,
          allTasks,
          activeTaskCount: tasks.length,
          deadlockDetectionMs,
          deadlockSlaTargetMs,
          deadlockWithinSla,
        })

        const bgSummary = backgroundManager
          ? getGlobalSummary(backgroundManager)
          : null

        return JSON.stringify({
          activeTasks: tasks.length,
          anomalies: summary,
          anomalyCount: report.anomalies.length,
          anomalyDetails: report.anomalies,
          dispatch,
          deadlockDetectionMs,
          deadlockSlaTargetMs,
          deadlockWithinSla,
          recommendedActions,
          actionPlan,
          governanceOverview,
          progressOverview,
          p1DodStatus,
          backgroundTasks: bgSummary,
        })
      } catch (error) {
        return JSON.stringify({ error: "health_check_failed", message: String(error) })
      }
    },
  })
}
