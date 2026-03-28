import type { TaskObject } from "../../tools/task/types"
import type { AnomalyType, TaskHealthEntry } from "./types"
import { getEntry } from "./health-sidecar"
import type { AnomalyCheckResult } from "./anomaly-checks"
import {
  detectStalePending,
  detectStaleInProgress,
  detectOrphanCandidate,
  detectOwnershipDrift,
  detectDependencyDeadlock,
  detectTodoDiverged,
} from "./anomaly-checks"

const DEFAULT_COOLDOWN_MS = 5 * 60_000

export interface AnomalyReport {
  anomalies: AnomalyCheckResult[]
  scannedCount: number
  timestamp: number
}

export interface ScanOptions {
  now?: number
  cooldownMs?: number
  todoStatusMap?: Map<string, string>
  config?: Record<string, unknown>
}

function isOpenTask(task: TaskObject): boolean {
  return task.status === "pending" || task.status === "in_progress"
}

function isCoolingDown(
  entry: TaskHealthEntry,
  anomalyType: AnomalyType,
  now: number,
  cooldownMs: number,
): boolean {
  const lastNotified = entry.lastNotifiedAt[anomalyType]
  if (lastNotified === undefined) return false
  return now - lastNotified < cooldownMs
}

function filterByCooldown(
  results: (AnomalyCheckResult | null)[],
  entry: TaskHealthEntry | null,
  now: number,
  cooldownMs: number,
): AnomalyCheckResult[] {
  const filtered: AnomalyCheckResult[] = []

  for (const result of results) {
    if (result === null) continue
    if (entry && isCoolingDown(entry, result.type, now, cooldownMs)) continue
    filtered.push(result)
  }

  return filtered
}

function scanSingleTask(
  task: TaskObject,
  entry: TaskHealthEntry | null,
  allTasks: Map<string, TaskObject>,
  options: ScanOptions,
): AnomalyCheckResult[] {
  const now = options.now ?? Date.now()
  const cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS

  if (!isOpenTask(task)) return []

  const effectiveEntry: TaskHealthEntry = entry ?? {
    taskId: task.id,
    createdAt: now,
    lastStatusChangeAt: now,
    lastTaskToolAt: now,
    lastObservedAt: now,
    originSessionID: task.threadID ?? "unknown",
    originSessionType: "main",
    anomalyFlags: [],
    lastNotifiedAt: {},
  }

  const checks: (AnomalyCheckResult | null)[] = [
    detectStalePending(effectiveEntry, task, now),
    detectStaleInProgress(effectiveEntry, task, now),
    detectOrphanCandidate(effectiveEntry, task, now),
    detectOwnershipDrift(task.id, task),
    detectDependencyDeadlock(task.id, task, allTasks),
  ]

  const todoStatus = options.todoStatusMap?.get(task.id) ?? null
  checks.push(detectTodoDiverged(task.id, task, todoStatus))

  return filterByCooldown(checks, effectiveEntry, now, cooldownMs)
}

export function scanAllTasks(
  tasks: TaskObject[],
  options: ScanOptions = {},
): AnomalyReport {
  const now = options.now ?? Date.now()
  const allTasks = new Map<string, TaskObject>()

  for (const task of tasks) {
    allTasks.set(task.id, task)
  }

  const anomalies: AnomalyCheckResult[] = []
  let scannedCount = 0

  for (const task of tasks) {
    if (!isOpenTask(task)) continue
    scannedCount += 1

    const entry = getEntry(task.id, options.config)
    const results = scanSingleTask(task, entry, allTasks, { ...options, now })
    anomalies.push(...results)
  }

  return {
    anomalies,
    scannedCount,
    timestamp: now,
  }
}

export function formatSummary(report: AnomalyReport): string {
  if (report.anomalies.length === 0) {
    return `tasks: ${report.scannedCount} active / 0 anomalies`
  }

  const bySeverity = { critical: 0, error: 0, warning: 0, info: 0 }
  for (const a of report.anomalies) {
    bySeverity[a.severity] += 1
  }

  const parts: string[] = [`tasks: ${report.scannedCount} active`]

  if (bySeverity.critical > 0) parts.push(`${bySeverity.critical} critical`)
  if (bySeverity.error > 0) parts.push(`${bySeverity.error} error`)
  if (bySeverity.warning > 0) parts.push(`${bySeverity.warning} warning`)
  if (bySeverity.info > 0) parts.push(`${bySeverity.info} info`)

  return parts.join(" / ")
}
