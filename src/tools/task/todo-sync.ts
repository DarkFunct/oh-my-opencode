import type { PluginInput } from "@opencode-ai/plugin";
import { log } from "../../shared/logger";
import type { Task } from "../../features/claude-tasks/types.ts";
import { syncTaskToTodo, todosMatch } from "./todo-sync-mapper";
import { notifyTodoSyncLease } from "./todo-sync-lease";
import { extractTodos, resolveTodoWriter } from "./todo-sync-writer";
import type { TodoInfo, TodoSyncResult, TodoWriter } from "./todo-sync-types";

export const TODO_SYNC_VISIBILITY_TIMEOUT_MS = 5_000;

interface TodoSyncOptions {
  visibilityTimeoutMs?: number;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutReason: string): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(timeoutReason)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]);
}

function asSyncResult(
  syncError: string | null,
  visibleWithinMs?: number,
  timeoutMs?: number,
): TodoSyncResult {
  if (syncError) {
    return {
      status: "failed",
      reason: syncError,
      ...(visibleWithinMs !== undefined ? { visibleWithinMs } : {}),
      ...(timeoutMs !== undefined ? { timeoutMs } : {}),
    };
  }

  return {
    status: "synced",
  };
}

export async function syncTaskTodoUpdate(
  ctx: PluginInput | undefined,
  task: Task,
  sessionID: string,
  writer?: TodoWriter,
  options?: TodoSyncOptions,
): Promise<TodoSyncResult> {
  const startedAt = Date.now();
  const timeoutMs = options?.visibilityTimeoutMs ?? TODO_SYNC_VISIBILITY_TIMEOUT_MS;

  if (!ctx) {
    return {
      status: "skipped",
      reason: "missing_plugin_context",
      visibleWithinMs: Date.now() - startedAt,
      timeoutMs,
    };
  }

  let syncError: string | null = null;

  try {
    const response = await withTimeout(ctx.client.session.todo({
      path: { id: sessionID },
    }), timeoutMs, `todo_fetch_timeout_${timeoutMs}ms`);
    const currentTodos = extractTodos(response);
    const taskTodo = syncTaskToTodo(task);
    const nextTodos = currentTodos.filter((todo) => {
      if (taskTodo) {
        return !todosMatch(todo, taskTodo);
      }
      // Deleted task: match by id if present, otherwise by content
      if (todo.id) {
        return todo.id !== task.id;
      }
      return todo.content !== task.subject;
    });
    const todo = taskTodo;

    if (todo) {
      nextTodos.push(todo);
    }

    const resolvedWriter = writer ?? (await resolveTodoWriter());
    if (!resolvedWriter) {
      syncError = "todo_writer_unavailable";
      return asSyncResult(syncError);
    }
    await withTimeout(
      resolvedWriter({ sessionID, todos: nextTodos }),
      timeoutMs,
      `todo_write_timeout_${timeoutMs}ms`,
    );
  } catch (err) {
    syncError = String(err);
    log("[todo-sync] Failed to sync task todo", {
      error: String(err),
      sessionID,
    });
  } finally {
    if (syncError) {
      await notifyTodoSyncLease({
        ctx,
        sessionID,
        action: "nack",
        reason: syncError,
      });
    } else {
      await notifyTodoSyncLease({
        ctx,
        sessionID,
        action: "ack",
      });
    }
  }

  return asSyncResult(syncError, Date.now() - startedAt, timeoutMs);
}

export async function syncAllTasksToTodos(
  ctx: PluginInput,
  tasks: Task[],
  sessionID?: string,
  writer?: TodoWriter,
  options?: TodoSyncOptions,
): Promise<TodoSyncResult> {
  const startedAt = Date.now();
  const timeoutMs = options?.visibilityTimeoutMs ?? TODO_SYNC_VISIBILITY_TIMEOUT_MS;
  let syncError: string | null = null;

  try {
    let currentTodos: TodoInfo[] = [];
    try {
      const response = await withTimeout(ctx.client.session.todo({
        path: { id: sessionID || "" },
      }), timeoutMs, `todo_fetch_timeout_${timeoutMs}ms`);
      currentTodos = extractTodos(response);
    } catch (err) {
      log("[todo-sync] Failed to fetch current todos", {
        error: String(err),
        sessionID,
      });
    }

    const newTodos: TodoInfo[] = [];
    const tasksToRemove = new Set<string>();
    const allTaskSubjects = new Set<string>();

    for (const task of tasks) {
      allTaskSubjects.add(task.subject);
      const todo = syncTaskToTodo(task);
      if (todo === null) {
        tasksToRemove.add(task.id);
      } else {
        newTodos.push(todo);
      }
    }

    const finalTodos: TodoInfo[] = [];

    const removedTaskSubjects = new Set(
      tasks.filter((t) => t.status === "deleted").map((t) => t.subject),
    );

    for (const existing of currentTodos) {
      const isInNewTodos = newTodos.some((newTodo) => todosMatch(existing, newTodo));
      const isRemovedById = existing.id ? tasksToRemove.has(existing.id) : false;
      const isRemovedByContent = !existing.id && removedTaskSubjects.has(existing.content);
      const isReplacedByTask = !existing.id && allTaskSubjects.has(existing.content);
      if (!isInNewTodos && !isRemovedById && !isRemovedByContent && !isReplacedByTask) {
        finalTodos.push(existing);
      }
    }

    finalTodos.push(...newTodos);

    const resolvedWriter = writer ?? (await resolveTodoWriter());
    if (resolvedWriter && sessionID) {
      await withTimeout(
        resolvedWriter({ sessionID, todos: finalTodos }),
        timeoutMs,
        `todo_write_timeout_${timeoutMs}ms`,
      );
    } else if (!resolvedWriter) {
      syncError = "todo_writer_unavailable";
    }

    log("[todo-sync] Synced todos", {
      count: finalTodos.length,
      sessionID,
    });
  } catch (err) {
    syncError = String(err);
    log("[todo-sync] Error in syncAllTasksToTodos", {
      error: String(err),
      sessionID,
    });
  } finally {
    if (sessionID) {
      if (syncError) {
        await notifyTodoSyncLease({
          ctx,
          sessionID,
          action: "nack",
          reason: syncError,
        });
      } else {
        await notifyTodoSyncLease({
          ctx,
          sessionID,
          action: "ack",
        });
      }
    }
  }

  return asSyncResult(syncError, Date.now() - startedAt, timeoutMs);
}

export { syncTaskToTodo } from "./todo-sync-mapper";
export type { TodoInfo } from "./todo-sync-types";
