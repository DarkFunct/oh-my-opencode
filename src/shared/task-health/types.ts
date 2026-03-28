export type AnomalyType =
  | "stale_pending"
  | "stale_in_progress"
  | "orphan_candidate"
  | "ownership_drift"
  | "burst_created"
  | "burst_created_root"
  | "subagent_task_violation"
  | "dependency_deadlock"
  | "todo_diverged"
  | "bg_unread"

export interface TaskHealthEntry {
  taskId: string
  createdAt: number
  lastStatusChangeAt: number
  lastTaskToolAt: number
  lastObservedAt: number
  originSessionID: string
  originSessionType: "main" | "subagent"
  detachedAt?: number
  anomalyFlags: AnomalyType[]
  lastNotifiedAt: Record<string, number>
}

export interface HealthIndex {
  version: 1
  updatedAt: number
  entries: Record<string, TaskHealthEntry>
}

export type ThresholdSeverity = "soft" | "hard"

export interface ThresholdConfig {
  softMs: number
  hardMs: number
}

export interface ThresholdResult {
  exceeded: boolean
  severity: ThresholdSeverity | null
  elapsedMs: number
  thresholdMs: number
}

export interface ThresholdMetadata {
  expectedDurationMs?: number
  longRunning?: boolean
}
