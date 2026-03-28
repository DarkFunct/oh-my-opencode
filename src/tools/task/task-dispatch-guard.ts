import { existsSync, readdirSync } from "fs"
import { join } from "path"
import { readJsonSafe } from "../../features/claude-tasks/storage"
import { TaskObjectSchema } from "./types"
import type { TaskObject, TaskStatus } from "./types"

interface DispatchTransitionInput {
  taskDir: string
  taskId: string
  blockedBy: string[]
  status: TaskStatus
}

export interface DispatchTransitionViolation {
  code: "dependency_cycle" | "blocked_transition"
  message: string
  blockedBy?: string[]
}

function isOpenStatus(status: TaskStatus): boolean {
  return status === "pending" || status === "in_progress"
}

function loadTaskMap(taskDir: string): Map<string, TaskObject> {
  const taskMap = new Map<string, TaskObject>()
  if (!existsSync(taskDir)) {
    return taskMap
  }

  const files = readdirSync(taskDir).filter((file) => file.endsWith(".json") && file.startsWith("T-"))
  for (const file of files) {
    const task = readJsonSafe(join(taskDir, file), TaskObjectSchema)
    if (!task) continue
    taskMap.set(task.id, task)
  }

  return taskMap
}

function resolveUnresolvedBlockers(blockedBy: string[], taskMap: Map<string, TaskObject>): string[] {
  return blockedBy.filter((blockerId) => {
    const blocker = taskMap.get(blockerId)
    if (!blocker) return true
    return blocker.status !== "completed"
  })
}

function buildAdjacency(taskMap: Map<string, TaskObject>): Map<string, string[]> {
  const adjacency = new Map<string, string[]>()

  for (const task of taskMap.values()) {
    if (!isOpenStatus(task.status)) continue

    const deps = task.blockedBy.filter((blockerId) => {
      const blocker = taskMap.get(blockerId)
      if (!blocker) return false
      return isOpenStatus(blocker.status)
    })

    adjacency.set(task.id, deps)
  }

  return adjacency
}

function hasCycleFrom(taskId: string, adjacency: Map<string, string[]>): boolean {
  const visited = new Set<string>()
  const stack = new Set<string>()

  const dfs = (currentId: string): boolean => {
    if (stack.has(currentId)) return true
    if (visited.has(currentId)) return false

    visited.add(currentId)
    stack.add(currentId)
    const blockers = adjacency.get(currentId) ?? []
    for (const blockerId of blockers) {
      if (dfs(blockerId)) return true
    }
    stack.delete(currentId)
    return false
  }

  return dfs(taskId)
}

export function validateDispatchTransition(input: DispatchTransitionInput): DispatchTransitionViolation | null {
  const taskMap = loadTaskMap(input.taskDir)
  const existingTask = taskMap.get(input.taskId)
  if (!existingTask) {
    return null
  }

  taskMap.set(input.taskId, {
    ...existingTask,
    status: input.status,
    blockedBy: input.blockedBy,
  })

  if (input.status === "in_progress") {
    const unresolvedBlockers = resolveUnresolvedBlockers(input.blockedBy, taskMap)
    if (unresolvedBlockers.length > 0) {
      return {
        code: "blocked_transition",
        message: "Cannot move task to in_progress while unresolved blockers remain",
        blockedBy: unresolvedBlockers,
      }
    }
  }

  if (isOpenStatus(input.status)) {
    const adjacency = buildAdjacency(taskMap)
    if (hasCycleFrom(input.taskId, adjacency)) {
      return {
        code: "dependency_cycle",
        message: "Cannot update task because blockedBy graph would contain a cycle",
      }
    }
  }

  return null
}
