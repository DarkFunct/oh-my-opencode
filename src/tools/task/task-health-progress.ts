import type { TaskObject } from "./types"

const DEFAULT_WINDOW_HOURS = 24
const DEFAULT_WINDOW_MS = DEFAULT_WINDOW_HOURS * 60 * 60 * 1000

function getMetaNumber(task: TaskObject, key: string): number | null {
  const value = task.metadata?.[key]
  return typeof value === "number" ? value : null
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export interface ProgressOverview {
  generatedAtMs: number
  windowHours: number
  createdInWindow: number
  completedInWindow: number
  statusTransitionsInWindow: number
  completionVelocityPerHour: number
  completionRate: number | null
  metadataCoverage: {
    createdAtMs: number
    completedAtMs: number
    lastStatusChangeAtMs: number
    ownerSessionID: number
  }
}

export function buildProgressOverview(
  tasks: TaskObject[],
  nowMs = Date.now(),
): ProgressOverview {
  const cutoff = nowMs - DEFAULT_WINDOW_MS

  let createdInWindow = 0
  let completedInWindow = 0
  let statusTransitionsInWindow = 0

  let hasCreatedAtCount = 0
  let hasCompletedAtCount = 0
  let hasLastStatusChangeAtCount = 0
  let hasOwnerSessionIDCount = 0

  for (const task of tasks) {
    const createdAtMs = getMetaNumber(task, "createdAtMs")
    const completedAtMs = getMetaNumber(task, "completedAtMs")
    const lastStatusChangeAtMs = getMetaNumber(task, "lastStatusChangeAtMs")
    const ownerSessionID = task.metadata?.ownerSessionID

    if (createdAtMs !== null) {
      hasCreatedAtCount++
      if (createdAtMs >= cutoff) {
        createdInWindow++
      }
    }

    if (completedAtMs !== null) {
      hasCompletedAtCount++
      if (completedAtMs >= cutoff) {
        completedInWindow++
      }
    }

    if (lastStatusChangeAtMs !== null) {
      hasLastStatusChangeAtCount++
      if (lastStatusChangeAtMs >= cutoff) {
        statusTransitionsInWindow++
      }
    }

    if (typeof ownerSessionID === "string") {
      hasOwnerSessionIDCount++
    }
  }

  return {
    generatedAtMs: nowMs,
    windowHours: DEFAULT_WINDOW_HOURS,
    createdInWindow,
    completedInWindow,
    statusTransitionsInWindow,
    completionVelocityPerHour: roundTo(completedInWindow / DEFAULT_WINDOW_HOURS, 3),
    completionRate: createdInWindow > 0 ? roundTo(completedInWindow / createdInWindow, 3) : null,
    metadataCoverage: {
      createdAtMs: hasCreatedAtCount,
      completedAtMs: hasCompletedAtCount,
      lastStatusChangeAtMs: hasLastStatusChangeAtCount,
      ownerSessionID: hasOwnerSessionIDCount,
    },
  }
}
