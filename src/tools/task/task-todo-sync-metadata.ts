import type { TaskObject } from "./types"
import type { TodoSyncResult } from "./todo-sync-types"

const TODO_SYNC_FAILURE_KEYS = [
  "todoSyncLastFailureAtMs",
  "todoSyncLastFailureReason",
  "todoSyncLastFailureVisibleWithinMs",
  "todoSyncLastFailureTimeoutMs",
  "todoSyncLastFailureVisibleWithinSla",
] as const

function ensureMetadata(task: TaskObject): Record<string, unknown> {
  const metadata = { ...(task.metadata ?? {}) }
  task.metadata = metadata
  return metadata
}

function clearFailureMetadata(metadata: Record<string, unknown>): void {
  for (const key of TODO_SYNC_FAILURE_KEYS) {
    if (key in metadata) {
      delete metadata[key]
    }
  }
}

export function applyTodoSyncOutcomeMetadata(
  task: TaskObject,
  outcome: TodoSyncResult,
  nowMs: number,
): void {
  const metadata = ensureMetadata(task)

  if (outcome.status === "failed") {
    metadata.todoSyncLastFailureAtMs = nowMs
    metadata.todoSyncLastFailureReason = outcome.reason ?? "unknown"
    if (typeof outcome.visibleWithinMs === "number") {
      metadata.todoSyncLastFailureVisibleWithinMs = outcome.visibleWithinMs
    }
    if (typeof outcome.timeoutMs === "number") {
      metadata.todoSyncLastFailureTimeoutMs = outcome.timeoutMs
    }

    const withinSla =
      typeof outcome.visibleWithinMs === "number" &&
      typeof outcome.timeoutMs === "number" &&
      outcome.visibleWithinMs <= outcome.timeoutMs
    metadata.todoSyncLastFailureVisibleWithinSla = withinSla
    return
  }

  if (outcome.status === "synced") {
    metadata.todoSyncLastAckAtMs = nowMs
    clearFailureMetadata(metadata)
  }
}
