import { log } from "../../shared/logger"
import { saveOpenCodeTodos, type OpenCodeTodo } from "../../hooks/claude-code-hooks/todo"
import type { TodoInfo, TodoWriter } from "./todo-sync-types"

function createFileBasedWriter(): TodoWriter {
  return async ({ sessionID, todos }) => {
    const mapped: OpenCodeTodo[] = todos.map((t) => ({
      content: t.content,
      status: t.status,
      priority: t.priority ?? "medium",
      id: t.id ?? "",
    }))
    saveOpenCodeTodos(sessionID, mapped)
    log("[todo-sync] Wrote todos via file-based fallback", { sessionID, count: mapped.length })
  }
}

export async function resolveTodoWriter(): Promise<TodoWriter | null> {
  return createFileBasedWriter()
}

export function extractTodos(response: unknown): TodoInfo[] {
  const payload = response as { data?: unknown }
  if (Array.isArray(payload?.data)) {
    return payload.data as TodoInfo[]
  }
  if (Array.isArray(response)) {
    return response as TodoInfo[]
  }
  return []
}
