/// <reference types="bun-types/test-globals" />

import type { ToolContext } from "@opencode-ai/plugin/tool"
import type { OhMyOpenCodeConfig } from "../../config/schema"
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs"
import { join } from "path"
import type { TaskObject } from "./types"
import { createTaskReconcileTool } from "./task-reconcile-tool"
import * as leaseSignal from "./todo-sync-lease"

const TEST_STORAGE = ".test-task-reconcile-tool"
const TEST_DIR = join(process.cwd(), TEST_STORAGE)
const TEST_CONFIG: Partial<OhMyOpenCodeConfig> = {
  sisyphus: {
    tasks: {
      storage_path: TEST_STORAGE,
      claude_code_compat: false,
    },
  },
}

const TEST_CONTEXT: ToolContext = {
  sessionID: "test-session-reconcile",
  messageID: "test-message-reconcile",
  agent: "test-agent",
  directory: TEST_DIR,
  worktree: TEST_DIR,
  metadata: () => {},
  ask: async () => {},
  abort: new AbortController().signal,
}

describe("task_reconcile tool lease linkage", () => {
  beforeEach(() => {
    if (existsSync(TEST_STORAGE)) {
      rmSync(TEST_STORAGE, { recursive: true, force: true })
    }
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(TEST_STORAGE)) {
      rmSync(TEST_STORAGE, { recursive: true, force: true })
    }
  })

  test("sends nack when orphan cleanup happened", async () => {
    const task: TaskObject = {
      id: "T-reconcile-001",
      subject: "stale task",
      description: "stale task",
      status: "pending",
      blocks: [],
      blockedBy: [],
      threadID: TEST_CONTEXT.sessionID,
      metadata: {
        createdAtMs: 0,
      },
    }
    writeFileSync(join(TEST_DIR, "T-reconcile-001.json"), JSON.stringify(task), "utf8")

    const leaseSpy = vi.spyOn(leaseSignal, "notifyTodoSyncLease").mockResolvedValue(undefined)
    const tool = createTaskReconcileTool(TEST_CONFIG)

    const result = JSON.parse(await tool.execute({ operation: "clean_orphans" }, TEST_CONTEXT))

    expect(result.orphansCleaned).toBe(1)
    expect(leaseSpy).toHaveBeenCalledTimes(1)
    const call = leaseSpy.mock.calls[0]?.[0] as {
      action: "ack" | "nack"
      reason?: string
    }
    expect(call.action).toBe("nack")
    expect(call.reason).toContain("orphans_cleaned:1")
    leaseSpy.mockRestore()
  })

  test("sends ack when rebuild_sidecar succeeds", async () => {
    const leaseSpy = vi.spyOn(leaseSignal, "notifyTodoSyncLease").mockResolvedValue(undefined)
    const tool = createTaskReconcileTool(TEST_CONFIG)

    const result = JSON.parse(await tool.execute({ operation: "rebuild_sidecar" }, TEST_CONTEXT))

    expect(result.error).toBeUndefined()
    expect(leaseSpy).toHaveBeenCalledTimes(1)
    const call = leaseSpy.mock.calls[0]?.[0] as {
      action: "ack" | "nack"
      reason?: string
    }
    expect(call.action).toBe("ack")
    leaseSpy.mockRestore()
  })
})
