import type { PluginInput } from "@opencode-ai/plugin"
import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { existsSync, readdirSync } from "fs"
import { join } from "path"
import type { OhMyOpenCodeConfig } from "../../config/schema"
import { TaskObjectSchema } from "./types"
import type { TaskObject } from "./types"
import { getTaskDir, readJsonSafe, writeJsonAtomic, acquireLock } from "../../features/claude-tasks/storage"
import { loadIndex, upsertEntry, flush } from "../../shared/task-health"
import { notifyTodoSyncLease } from "./todo-sync-lease"

interface ReconcileResult {
  scanned: number
  orphansCleaned: number
  sidecarRebuilt: boolean
  errors: string[]
}

function loadAllTasks(taskDir: string): TaskObject[] {
  if (!existsSync(taskDir)) return []
  const files = readdirSync(taskDir).filter((f) => f.endsWith(".json") && f.startsWith("T-"))
  const tasks: TaskObject[] = []

  for (const file of files) {
    const task = readJsonSafe(join(taskDir, file), TaskObjectSchema)
    if (task) tasks.push(task)
  }

  return tasks
}

function cleanOrphans(
  tasks: TaskObject[],
  taskDir: string,
  dryRun: boolean,
): { cleaned: number; errors: string[] } {
  const errors: string[] = []
  let cleaned = 0
  const now = Date.now()
  const STALE_THRESHOLD_MS = 4 * 60 * 60 * 1000

  for (const task of tasks) {
    if (task.status !== "pending" && task.status !== "in_progress") continue

    const taskPath = join(taskDir, `${task.id}.json`)
    const createdAtMs = task.metadata?.createdAtMs
    const age = typeof createdAtMs === "number" ? now - createdAtMs : Infinity

    if (age < STALE_THRESHOLD_MS && task.status === "pending") continue

    if (!dryRun) {
      try {
        const updated = { ...task, status: "deleted" as const }
        writeJsonAtomic(taskPath, TaskObjectSchema.parse(updated))
        cleaned++
      } catch (e) {
        errors.push(`Failed to clean ${task.id}: ${String(e)}`)
      }
    } else {
      cleaned++
    }
  }

  return { cleaned, errors }
}

function rebuildSidecar(tasks: TaskObject[], config: Partial<OhMyOpenCodeConfig>): void {
  loadIndex(config)
  const now = Date.now()

  for (const task of tasks) {
    if (task.status === "deleted") continue
    upsertEntry(task.id, {
      createdAt: (task.metadata?.createdAtMs as number) ?? now,
      lastStatusChangeAt: now,
      lastTaskToolAt: now,
      originSessionType: "main",
    }, config)
  }

  flush(config)
}

export function createTaskReconcileTool(
  config: Partial<OhMyOpenCodeConfig>,
  ctx?: PluginInput,
): ToolDefinition {
  return tool({
    description: `Reconcile task system state. Cleans orphan tasks and rebuilds health sidecar.

Operations:
- clean_orphans: Mark stale pending/in_progress tasks as deleted (4h threshold for pending)
- rebuild_sidecar: Rebuild health index from current task files
- all: Run both operations

Use dry_run=true to preview without making changes.`,
    args: {
      operation: tool.schema
        .enum(["clean_orphans", "rebuild_sidecar", "all"])
        .describe("Which reconcile operation to run"),
      dry_run: tool.schema
        .boolean()
        .optional()
        .describe("Preview changes without applying (default: false)"),
    },
    execute: async (
      args: Record<string, unknown>,
      context: { sessionID: string },
    ): Promise<string> => {
      let leaseAction: "ack" | "nack" = "ack"
      let leaseReason: string | undefined

      try {
        const operation = (args.operation as string) ?? "all"
        const dryRun = (args.dry_run as boolean) ?? false
        const taskDir = getTaskDir(config)
        const lock = acquireLock(taskDir)

        if (!lock.acquired) {
          leaseAction = "nack"
          leaseReason = "task_lock_unavailable"
          return JSON.stringify({ error: "task_lock_unavailable" })
        }

        try {
          const tasks = loadAllTasks(taskDir)
          const result: ReconcileResult = {
            scanned: tasks.length,
            orphansCleaned: 0,
            sidecarRebuilt: false,
            errors: [],
          }

          if (operation === "clean_orphans" || operation === "all") {
            const { cleaned, errors } = cleanOrphans(tasks, taskDir, dryRun)
            result.orphansCleaned = cleaned
            result.errors.push(...errors)
          }

          if (operation === "rebuild_sidecar" || operation === "all") {
            if (!dryRun) {
              rebuildSidecar(tasks, config)
            }
            result.sidecarRebuilt = !dryRun
          }

          if (result.errors.length > 0) {
            leaseAction = "nack"
            leaseReason = result.errors[0]
          } else if (!dryRun && result.orphansCleaned > 0) {
            leaseAction = "nack"
            leaseReason = `orphans_cleaned:${result.orphansCleaned}`
          } else {
            leaseAction = "ack"
            leaseReason = undefined
          }

          return JSON.stringify({ ...result, dryRun })
        } finally {
          lock.release()
        }
      } catch (error) {
        leaseAction = "nack"
        leaseReason = String(error)
        return JSON.stringify({ error: "reconcile_failed", message: String(error) })
      } finally {
        await notifyTodoSyncLease({
          ctx,
          sessionID: context.sessionID,
          action: leaseAction,
          reason: leaseReason,
        })
      }
    },
  })
}
