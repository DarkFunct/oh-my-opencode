import { join } from "path"
import { z } from "zod"
import type { OhMyOpenCodeConfig } from "../../config/schema"
import { getTaskDir, readJsonSafe, writeJsonAtomic } from "../../features/claude-tasks/storage"
import { log } from "../../shared/logger"
import type { HealthIndex, TaskHealthEntry } from "./types"

const HEALTH_INDEX_FILENAME = ".health-index.json"

const AnomalyTypeSchema = z.enum([
  "stale_pending",
  "stale_in_progress",
  "orphan_candidate",
  "ownership_drift",
  "burst_created",
  "burst_created_root",
  "subagent_task_violation",
  "dependency_deadlock",
  "todo_diverged",
  "bg_unread",
])

const TaskHealthEntrySchema: z.ZodType<TaskHealthEntry> = z
  .object({
    taskId: z.string(),
    createdAt: z.number(),
    lastStatusChangeAt: z.number(),
    lastTaskToolAt: z.number(),
    lastObservedAt: z.number(),
    originSessionID: z.string(),
    originSessionType: z.enum(["main", "subagent"]),
    detachedAt: z.number().optional(),
    anomalyFlags: z.array(AnomalyTypeSchema),
    lastNotifiedAt: z.record(z.string(), z.number()),
  })
  .strict()

const HealthIndexSchema: z.ZodType<HealthIndex> = z
  .object({
    version: z.literal(1),
    updatedAt: z.number(),
    entries: z.record(z.string(), TaskHealthEntrySchema),
  })
  .strict()

let entryCache = new Map<string, TaskHealthEntry>()
let cacheLoaded = false
let dirty = false
let activeIndexPath: string | null = null

function resolveIndexPath(config: Partial<OhMyOpenCodeConfig> = {}): string {
  return join(getTaskDir(config), HEALTH_INDEX_FILENAME)
}

function cloneEntry(entry: TaskHealthEntry): TaskHealthEntry {
  return {
    ...entry,
    anomalyFlags: [...entry.anomalyFlags],
    lastNotifiedAt: { ...entry.lastNotifiedAt },
  }
}

function toSnapshot(updatedAt: number = Date.now()): HealthIndex {
  const entries: Record<string, TaskHealthEntry> = {}
  for (const [taskId, entry] of entryCache.entries()) {
    entries[taskId] = cloneEntry(entry)
  }

  return {
    version: 1,
    updatedAt,
    entries,
  }
}

function ensureLoaded(config: Partial<OhMyOpenCodeConfig> = {}): void {
  const indexPath = resolveIndexPath(config)
  if (!cacheLoaded || activeIndexPath !== indexPath) {
    loadIndex(config)
  }
}

function createDefaultEntry(taskId: string, now: number): TaskHealthEntry {
  return {
    taskId,
    createdAt: now,
    lastStatusChangeAt: now,
    lastTaskToolAt: now,
    lastObservedAt: now,
    originSessionID: "unknown",
    originSessionType: "main",
    anomalyFlags: [],
    lastNotifiedAt: {},
  }
}

export function loadIndex(config: Partial<OhMyOpenCodeConfig> = {}): HealthIndex {
  const indexPath = resolveIndexPath(config)
  const stored = readJsonSafe(indexPath, HealthIndexSchema)

  entryCache = new Map<string, TaskHealthEntry>()
  if (stored) {
    for (const [taskId, entry] of Object.entries(stored.entries)) {
      entryCache.set(taskId, entry)
    }
  }

  cacheLoaded = true
  dirty = false
  activeIndexPath = indexPath

  log("[task-health] health sidecar loaded", { indexPath, entries: entryCache.size })
  return stored ?? toSnapshot()
}

export function getEntry(taskId: string, config: Partial<OhMyOpenCodeConfig> = {}): TaskHealthEntry | null {
  ensureLoaded(config)
  const entry = entryCache.get(taskId)
  return entry ? cloneEntry(entry) : null
}

export function upsertEntry(
  taskId: string,
  partial: Partial<Omit<TaskHealthEntry, "taskId">>,
  config: Partial<OhMyOpenCodeConfig> = {},
): TaskHealthEntry {
  ensureLoaded(config)

  const now = Date.now()
  const existing = entryCache.get(taskId) ?? createDefaultEntry(taskId, now)
  const mergedNotifiedAt = partial.lastNotifiedAt
    ? { ...existing.lastNotifiedAt, ...partial.lastNotifiedAt }
    : existing.lastNotifiedAt

  const next: TaskHealthEntry = {
    ...existing,
    ...partial,
    taskId,
    anomalyFlags: partial.anomalyFlags
      ? Array.from(new Set(partial.anomalyFlags))
      : existing.anomalyFlags,
    lastNotifiedAt: mergedNotifiedAt,
    lastObservedAt: now,
  }

  entryCache.set(taskId, next)
  dirty = true
  return cloneEntry(next)
}

export function markDetached(sessionID: string, config: Partial<OhMyOpenCodeConfig> = {}): number {
  ensureLoaded(config)

  const now = Date.now()
  let updated = 0

  for (const [taskId, entry] of entryCache.entries()) {
    if (entry.originSessionID !== sessionID) continue

    entryCache.set(taskId, {
      ...entry,
      detachedAt: now,
      lastObservedAt: now,
    })
    updated += 1
  }

  if (updated > 0) {
    dirty = true
  }

  return updated
}

export function flush(config: Partial<OhMyOpenCodeConfig> = {}): void {
  ensureLoaded(config)

  const indexPath = resolveIndexPath(config)
  try {
    writeJsonAtomic(indexPath, toSnapshot())
    dirty = false
    activeIndexPath = indexPath
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    log("[task-health] health sidecar flush failed", { indexPath, reason })
    throw error
  }
}

export function flushIfDirty(config: Partial<OhMyOpenCodeConfig> = {}): boolean {
  ensureLoaded(config)
  if (!dirty) return false

  flush(config)
  return true
}
