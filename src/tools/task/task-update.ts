import type { PluginInput } from "@opencode-ai/plugin";
import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool";
import { join } from "path";
import type { OhMyOpenCodeConfig } from "../../config/schema";
import { TaskObjectSchema, TaskUpdateInputSchema } from "./types";
import {
  getTaskDir,
  readJsonSafe,
  writeJsonAtomic,
  acquireLock,
} from "../../features/claude-tasks/storage";
import { syncTaskTodoUpdate } from "./todo-sync";
import {
  applyStatusTransitionMetadata,
  claimOwnershipIfMissing,
  readOwnerSessionID,
} from "./task-lifecycle-metadata";
import { validateDispatchTransition } from "./task-dispatch-guard";
import { validateGranularityForStatus } from "./task-granularity-guard";
import { applyTodoSyncOutcomeMetadata } from "./task-todo-sync-metadata";
import { canCreatePersistentTask } from "../../shared/task-ownership-policy";

const TASK_ID_PATTERN = /^T-[A-Za-z0-9-]+$/;

function parseTaskId(id: string): string | null {
  if (!TASK_ID_PATTERN.test(id)) return null;
  return id;
}

export function createTaskUpdateTool(
  config: Partial<OhMyOpenCodeConfig>,
  ctx?: PluginInput,
): ToolDefinition {
   return tool({
     description: `Update an existing task with new values.

Supports updating: subject, description, status, activeForm, owner, metadata.
For blocks/blockedBy: use addBlocks/addBlockedBy to append (additive, not replacement).
For metadata: merge with existing, set key to null to delete.
Syncs to OpenCode Todo API after update.

**IMPORTANT - Dependency Management:**
Use \`addBlockedBy\` to declare dependencies on other tasks.
Properly managed dependencies enable maximum parallel execution.`,
     args: {
      id: tool.schema.string().describe("Task ID (required)"),
      subject: tool.schema.string().optional().describe("Task subject"),
      description: tool.schema.string().optional().describe("Task description"),
      status: tool.schema
        .enum(["pending", "in_progress", "completed", "deleted"])
        .optional()
        .describe("Task status"),
      activeForm: tool.schema
        .string()
        .optional()
        .describe("Active form (present continuous)"),
      owner: tool.schema
        .string()
        .optional()
        .describe("Task owner (agent name)"),
      addBlocks: tool.schema
        .array(tool.schema.string())
        .optional()
        .describe("Task IDs to add to blocks (additive, not replacement)"),
      addBlockedBy: tool.schema
        .array(tool.schema.string())
        .optional()
        .describe("Task IDs to add to blockedBy (additive, not replacement)"),
      metadata: tool.schema
        .record(tool.schema.string(), tool.schema.unknown())
        .optional()
        .describe("Task metadata to merge (set key to null to delete)"),
    },
    execute: async (args, context) => {
      return handleUpdate(args, config, ctx, context);
    },
  });
}

async function handleUpdate(
  args: Record<string, unknown>,
  config: Partial<OhMyOpenCodeConfig>,
  ctx: PluginInput | undefined,
  context: { sessionID: string },
): Promise<string> {
  try {
    if (!canCreatePersistentTask(context.sessionID)) {
      return JSON.stringify({ error: "subagent_denied", message: "Subagent sessions cannot modify persistent tasks" });
    }

    const validatedArgs = TaskUpdateInputSchema.parse(args);
    const taskId = parseTaskId(validatedArgs.id);
    if (!taskId) {
      return JSON.stringify({ error: "invalid_task_id" });
    }

    const taskDir = getTaskDir(config);
    const lock = acquireLock(taskDir);

    if (!lock.acquired) {
      return JSON.stringify({ error: "task_lock_unavailable" });
    }

    try {
      const taskPath = join(taskDir, `${taskId}.json`);
      const task = readJsonSafe(taskPath, TaskObjectSchema);

      if (!task) {
        return JSON.stringify({ error: "task_not_found" });
      }

      const ownerSessionID = readOwnerSessionID(task);
      if (ownerSessionID && ownerSessionID !== context.sessionID) {
        return JSON.stringify({
          error: "ownership_conflict",
          ownerSessionID,
        });
      }

      const metadataTimestamp = Date.now();
      claimOwnershipIfMissing(task, context.sessionID, metadataTimestamp);

      if (validatedArgs.subject !== undefined) {
        task.subject = validatedArgs.subject;
      }
      if (validatedArgs.description !== undefined) {
        task.description = validatedArgs.description;
      }
      const previousStatus = task.status;
      if (validatedArgs.status !== undefined) {
        task.status = validatedArgs.status;
      }
      if (validatedArgs.activeForm !== undefined) {
        task.activeForm = validatedArgs.activeForm;
      }
      if (validatedArgs.owner !== undefined) {
        task.owner = validatedArgs.owner;
      }

      const addBlocks = args.addBlocks as string[] | undefined;
      if (addBlocks) {
        task.blocks = [...new Set([...task.blocks, ...addBlocks])];
      }

      const addBlockedBy = args.addBlockedBy as string[] | undefined;
      if (addBlockedBy) {
        task.blockedBy = [...new Set([...task.blockedBy, ...addBlockedBy])];
      }

      if (validatedArgs.metadata !== undefined) {
        task.metadata = { ...task.metadata, ...validatedArgs.metadata };
        Object.keys(task.metadata).forEach((key) => {
          if (task.metadata?.[key] === null) {
            delete task.metadata[key];
          }
        });
      }

      if (validatedArgs.status !== undefined && validatedArgs.status !== previousStatus) {
        applyStatusTransitionMetadata(task, previousStatus, task.status, metadataTimestamp);
      }

      const granularityViolation = validateGranularityForStatus(task, task.status);
      if (granularityViolation) {
        return JSON.stringify({
          error: granularityViolation.code,
          message: granularityViolation.message,
          missingFields: granularityViolation.missingFields,
        });
      }

      const dispatchViolation = validateDispatchTransition({
        taskDir,
        taskId,
        blockedBy: task.blockedBy,
        status: task.status,
      });
      if (dispatchViolation) {
        return JSON.stringify({
          error: dispatchViolation.code,
          message: dispatchViolation.message,
          blockedBy: dispatchViolation.blockedBy,
        });
      }

      const validatedTask = TaskObjectSchema.parse(task);
      writeJsonAtomic(taskPath, validatedTask);

      const todoSyncResult = await syncTaskTodoUpdate(ctx, validatedTask, context.sessionID);

      const response: {
        task: typeof validatedTask
        todoSync?: {
          status: "failed"
          reason: string
          visibleWithinMs?: number
          timeoutMs?: number
          withinSla?: boolean
        }
      } = {
        task: validatedTask,
      }

      const taskWithTodoOutcome = TaskObjectSchema.parse({
        ...validatedTask,
        metadata: { ...(validatedTask.metadata ?? {}) },
      });
      applyTodoSyncOutcomeMetadata(taskWithTodoOutcome, todoSyncResult, Date.now());
      writeJsonAtomic(taskPath, taskWithTodoOutcome);
      response.task = taskWithTodoOutcome;

      if (todoSyncResult.status === "failed") {
        response.todoSync = {
          status: "failed",
          reason: todoSyncResult.reason ?? "unknown",
          ...(typeof todoSyncResult.visibleWithinMs === "number"
            ? { visibleWithinMs: todoSyncResult.visibleWithinMs }
            : {}),
          ...(typeof todoSyncResult.timeoutMs === "number"
            ? {
                timeoutMs: todoSyncResult.timeoutMs,
                withinSla:
                  typeof todoSyncResult.visibleWithinMs === "number"
                    ? todoSyncResult.visibleWithinMs <= todoSyncResult.timeoutMs
                    : false,
              }
            : {}),
        }
      }

      return JSON.stringify(response);
    } finally {
      lock.release();
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Required")) {
      return JSON.stringify({
        error: "validation_error",
        message: error.message,
      });
    }
    return JSON.stringify({ error: "internal_error" });
  }
}
