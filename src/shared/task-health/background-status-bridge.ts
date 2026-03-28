/**
 * Bridge between BackgroundManager and task health monitoring.
 * Reads BG manager state without modifying it. Tracks "collected" status separately.
 */

interface BackgroundTaskLike {
  id: string
  status: string
  parentSessionID: string
  startedAt?: Date
  completedAt?: Date
}

interface BackgroundManagerLike {
  getTasksByParentSession(sessionID: string): BackgroundTaskLike[]
  getRunningTasks(): BackgroundTaskLike[]
  getNonRunningTasks(): BackgroundTaskLike[]
  getTask(id: string): BackgroundTaskLike | undefined
}

export interface BackgroundSessionSummary {
  running: number
  pendingCount: number
  completedUnread: number
  errorUnread: number
  cancelledUnread: number
  oldestRunningAge: number
}

const EMPTY_SUMMARY: BackgroundSessionSummary = {
  running: 0,
  pendingCount: 0,
  completedUnread: 0,
  errorUnread: 0,
  cancelledUnread: 0,
  oldestRunningAge: 0,
}

const collectedSet = new Set<string>()

export function markCollected(taskId: string): void {
  collectedSet.add(taskId)
}

export function isCollected(taskId: string): boolean {
  return collectedSet.has(taskId)
}

export function getParentSessionSummary(
  manager: BackgroundManagerLike,
  sessionID: string,
): BackgroundSessionSummary {
  const tasks = manager.getTasksByParentSession(sessionID)
  if (tasks.length === 0) return { ...EMPTY_SUMMARY }

  const now = Date.now()
  let running = 0
  let pendingCount = 0
  let completedUnread = 0
  let errorUnread = 0
  let cancelledUnread = 0
  let oldestRunningAge = 0

  for (const task of tasks) {
    switch (task.status) {
      case "running": {
        running++
        if (task.startedAt) {
          const age = now - task.startedAt.getTime()
          if (age > oldestRunningAge) oldestRunningAge = age
        }
        break
      }
      case "pending":
        pendingCount++
        break
      case "completed":
        if (!collectedSet.has(task.id)) completedUnread++
        break
      case "error":
        if (!collectedSet.has(task.id)) errorUnread++
        break
      case "cancelled":
      case "interrupt":
        if (!collectedSet.has(task.id)) cancelledUnread++
        break
    }
  }

  return { running, pendingCount, completedUnread, errorUnread, cancelledUnread, oldestRunningAge }
}

export function getGlobalSummary(
  manager: BackgroundManagerLike,
): { running: number; pending: number; completed: number; errored: number } {
  const runningTasks = manager.getRunningTasks()
  const nonRunning = manager.getNonRunningTasks()

  let pending = 0
  let completed = 0
  let errored = 0

  for (const t of nonRunning) {
    switch (t.status) {
      case "pending":
        pending++
        break
      case "completed":
        completed++
        break
      case "error":
        errored++
        break
    }
  }

  return { running: runningTasks.length, pending, completed, errored }
}
