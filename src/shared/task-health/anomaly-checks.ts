import type { TaskObject } from "../../tools/task/types"
import type { AnomalyType, TaskHealthEntry, ThresholdResult } from "./types"
import {
  checkStalePending,
  checkStaleInProgress,
  checkDetachedOrphan,
  checkBurstCreation,
} from "./threshold-policy"

export interface AnomalyCheckResult {
  type: AnomalyType
  taskId: string
  severity: "info" | "warning" | "error" | "critical"
  message: string
  thresholdResult?: ThresholdResult
}

function severityFromThreshold(result: ThresholdResult): "warning" | "critical" {
  return result.severity === "hard" ? "critical" : "warning"
}

function formatMinutes(ms: number): string {
  return `${Math.round(ms / 60_000)}min`
}

export function detectStalePending(
  entry: TaskHealthEntry,
  task: TaskObject,
  now: number,
): AnomalyCheckResult | null {
  if (task.status !== "pending") return null

  const result = checkStalePending(entry, now, task.metadata)
  if (!result.exceeded) return null

  return {
    type: "stale_pending",
    taskId: entry.taskId,
    severity: severityFromThreshold(result),
    message: `Task "${task.subject}" pending for ${formatMinutes(result.elapsedMs)} (threshold: ${formatMinutes(result.thresholdMs)})`,
    thresholdResult: result,
  }
}

export function detectStaleInProgress(
  entry: TaskHealthEntry,
  task: TaskObject,
  now: number,
): AnomalyCheckResult | null {
  if (task.status !== "in_progress") return null

  const result = checkStaleInProgress(entry, now, task.metadata)
  if (!result.exceeded) return null

  return {
    type: "stale_in_progress",
    taskId: entry.taskId,
    severity: severityFromThreshold(result),
    message: `Task "${task.subject}" in_progress with no activity for ${formatMinutes(result.elapsedMs)} (threshold: ${formatMinutes(result.thresholdMs)})`,
    thresholdResult: result,
  }
}

export function detectOrphanCandidate(
  entry: TaskHealthEntry,
  task: TaskObject,
  now: number,
): AnomalyCheckResult | null {
  if (task.status === "completed" || task.status === "deleted") return null

  const result = checkDetachedOrphan(entry, now, task.metadata)
  if (!result.exceeded) return null

  return {
    type: "orphan_candidate",
    taskId: entry.taskId,
    severity: "critical",
    message: `Task "${task.subject}" detached from owner session for ${formatMinutes(result.elapsedMs)}`,
    thresholdResult: result,
  }
}

export function detectOwnershipDrift(
  taskId: string,
  task: TaskObject,
): AnomalyCheckResult | null {
  const ownerSessionID = task.metadata?.ownerSessionID
  if (typeof ownerSessionID !== "string") return null
  if (!task.threadID) return null
  if (ownerSessionID === task.threadID) return null

  return {
    type: "ownership_drift",
    taskId,
    severity: "warning",
    message: `Task "${task.subject}" ownerSessionID="${ownerSessionID}" differs from threadID="${task.threadID}"`,
  }
}

export function detectBurstCreation(
  recentTimestamps: number[],
  sessionId: string,
  isRoot: boolean,
): AnomalyCheckResult | null {
  const result = checkBurstCreation(recentTimestamps, isRoot)
  if (!result.exceeded) return null

  const scope = isRoot ? "root" : "session"
  const anomalyType: AnomalyType = isRoot ? "burst_created_root" : "burst_created"

  return {
    type: anomalyType,
    taskId: sessionId,
    severity: severityFromThreshold(result),
    message: `Burst creation in ${scope}: ${result.elapsedMs} tasks in window (threshold: ${result.thresholdMs})`,
    thresholdResult: result,
  }
}

export function detectSubagentViolation(
  taskId: string,
  sessionId: string,
): AnomalyCheckResult {
  return {
    type: "subagent_task_violation",
    taskId,
    severity: "error",
    message: `Subagent session ${sessionId} attempted to create task ${taskId}`,
  }
}

export function detectDependencyDeadlock(
  taskId: string,
  task: TaskObject,
  allTasks: Map<string, TaskObject>,
): AnomalyCheckResult | null {
  if (!task.blockedBy || task.blockedBy.length === 0) return null

  const visited = new Set<string>()
  const stack = new Set<string>()

  function hasCycle(currentId: string): boolean {
    if (stack.has(currentId)) return true
    if (visited.has(currentId)) return false

    visited.add(currentId)
    stack.add(currentId)

    const current = allTasks.get(currentId)
    if (current?.blockedBy) {
      for (const depId of current.blockedBy) {
        if (hasCycle(depId)) return true
      }
    }

    stack.delete(currentId)
    return false
  }

  if (!hasCycle(taskId)) return null

  return {
    type: "dependency_deadlock",
    taskId,
    severity: "critical",
    message: `Task "${task.subject}" is part of a dependency cycle`,
  }
}

export function detectTodoDiverged(
  taskId: string,
  task: TaskObject,
  todoStatus: string | null,
): AnomalyCheckResult | null {
  if (todoStatus === null) return null

  const taskStatus = task.status
  if (taskStatus === todoStatus) return null

  return {
    type: "todo_diverged",
    taskId,
    severity: "info",
    message: `Task "${task.subject}" status="${taskStatus}" but todo status="${todoStatus}"`,
  }
}

export function detectBgUnread(
  bgTaskId: string,
  turnsSinceCompletion: number,
): AnomalyCheckResult | null {
  if (turnsSinceCompletion < 1) return null

  return {
    type: "bg_unread",
    taskId: bgTaskId,
    severity: turnsSinceCompletion >= 5 ? "critical" : "warning",
    message: `Background task ${bgTaskId} completed ${turnsSinceCompletion} turns ago but not collected`,
  }
}
