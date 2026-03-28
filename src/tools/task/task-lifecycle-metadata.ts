import type { TaskObject, TaskStatus } from "./types"

type TaskMetadata = Record<string, unknown>

function ensureMetadata(task: TaskObject): TaskMetadata {
  const metadata = { ...(task.metadata ?? {}) }
  task.metadata = metadata
  return metadata
}

export function readOwnerSessionID(task: TaskObject): string | undefined {
  const ownerSessionID = task.metadata?.ownerSessionID
  return typeof ownerSessionID === "string" ? ownerSessionID : undefined
}

export function claimOwnershipIfMissing(task: TaskObject, sessionID: string, claimedAtMs: number): void {
  const metadata = ensureMetadata(task)
  if (typeof metadata.ownerSessionID === "string") {
    return
  }

  metadata.ownerSessionID = sessionID
  metadata.ownerClaimedAtMs = claimedAtMs
}

export function applyStatusTransitionMetadata(
  task: TaskObject,
  previousStatus: TaskStatus,
  nextStatus: TaskStatus,
  changedAtMs: number,
): void {
  if (previousStatus === nextStatus) {
    return
  }

  const metadata = ensureMetadata(task)
  metadata.lastStatusChangeAtMs = changedAtMs

  if (nextStatus === "completed") {
    metadata.completedAtMs = changedAtMs
    return
  }

  if ("completedAtMs" in metadata) {
    delete metadata.completedAtMs
  }
}
