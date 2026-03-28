import type { Task } from "../../features/claude-tasks/types.ts"
import type { TaskStatus, TodoInfo } from "./todo-sync-types"

function mapTaskStatusToTodoStatus(taskStatus: TaskStatus): TodoInfo["status"] | null {
  switch (taskStatus) {
    case "pending":
      return "pending"
    case "in_progress":
      return "in_progress"
    case "completed":
      return "completed"
    case "deleted":
      return null
    default:
      return "pending"
  }
}

function extractPriority(
  metadata?: Record<string, unknown>,
): TodoInfo["priority"] | undefined {
  if (!metadata) return undefined

  const priority = metadata.priority
  if (
    typeof priority === "string" &&
    ["low", "medium", "high"].includes(priority)
  ) {
    return priority as "low" | "medium" | "high"
  }

  return undefined
}

export function todosMatch(todo1: TodoInfo, todo2: TodoInfo): boolean {
  if (todo1.id && todo2.id) {
    return todo1.id === todo2.id
  }
  return todo1.content === todo2.content
}

export function syncTaskToTodo(task: Task): TodoInfo | null {
  const todoStatus = mapTaskStatusToTodoStatus(task.status)

  if (todoStatus === null) {
    return null
  }

  return {
    id: task.id,
    content: task.subject,
    status: todoStatus,
    priority: extractPriority(task.metadata),
  }
}
