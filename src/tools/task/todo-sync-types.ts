import type { Task } from "../../features/claude-tasks/types.ts"

export interface TodoInfo {
  id?: string
  content: string
  status: "pending" | "in_progress" | "completed" | "cancelled"
  priority?: "low" | "medium" | "high"
}

export interface TodoSyncResult {
  status: "synced" | "failed" | "skipped"
  reason?: string
  visibleWithinMs?: number
  timeoutMs?: number
}

export type TodoWriter = (input: {
  sessionID: string
  todos: TodoInfo[]
}) => Promise<void>

export type TaskStatus = Task["status"]
