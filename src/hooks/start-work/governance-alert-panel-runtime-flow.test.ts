declare const require: (name: string) => any
const { afterEach, beforeEach, describe, expect, test } = require("bun:test")

import type { PluginInput } from "@opencode-ai/plugin"
import type { ToolContext } from "@opencode-ai/plugin/tool"
import {
  createGovernanceRoutes,
  TaskLeaseFileStore,
  TaskLeaseManager,
} from "@gaia/kgs-middleware"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { writeBoulderState } from "../../features/boulder-state"
import { createTaskHealthHook } from "../task-health"
import { createTaskReconcileTool } from "../../tools/task/task-reconcile-tool"
import type { TaskObject } from "../../tools/task/types"
import { buildGovernanceDecisionAlertBlock } from "./governance-alert-panel"

function installGovernanceFetchProxy(baseUrl: string, router: ReturnType<typeof createGovernanceRoutes>): () => void {
  const originalFetch = globalThis.fetch
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "")

  const mockedFetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const targetUrl = new URL(String(input))
    if (targetUrl.origin !== normalizedBaseUrl) {
      return originalFetch(input, init)
    }

    const routePath = `${targetUrl.pathname}${targetUrl.search}`.replace("/api/v1/governance", "") || "/"
    return router.request(routePath, {
      method: init?.method,
      headers: init?.headers,
      body: init?.body,
    })
  }

  globalThis.fetch = mockedFetch
  return () => {
    globalThis.fetch = originalFetch
  }
}

async function seedLease(workspaceRoot: string, taskId: string): Promise<void> {
  const manager = new TaskLeaseManager(new TaskLeaseFileStore(workspaceRoot))
  await manager.acquire({
    taskId,
    ownerSessionId: "ses-owner",
    ownerRole: "Sisyphus-Junior",
    requiredCapability: "project.modify",
    ttlMs: 60_000,
  })
}

describe("governance alert panel runtime flow", () => {
  let workspaceRoot: string
  let baseUrl: string
  let restoreFetch: (() => void) | null
  let router: ReturnType<typeof createGovernanceRoutes>

  beforeEach(() => {
    workspaceRoot = join(tmpdir(), `governance-alert-panel-runtime-flow-${randomUUID()}`)
    mkdirSync(join(workspaceRoot, ".opencode"), { recursive: true })
    mkdirSync(join(workspaceRoot, ".sisyphus", "plans"), { recursive: true })
    writeFileSync(join(workspaceRoot, ".sisyphus", "plans", "test.md"), "# plan\n", "utf8")

    baseUrl = `http://gaia-runtime-flow-${randomUUID()}.local`
    writeFileSync(
      join(workspaceRoot, ".opencode", "oh-my-opencode.json"),
      JSON.stringify({
        start_work: {
          governance_precheck_url: baseUrl,
        },
      }),
      "utf8",
    )

    router = createGovernanceRoutes()
    restoreFetch = installGovernanceFetchProxy(baseUrl, router)
  })

  afterEach(() => {
    restoreFetch?.()
    restoreFetch = null
    rmSync(workspaceRoot, { recursive: true, force: true })
  })

  test("shows LEASE_REJECTED from background_output heartbeat mismatch", async () => {
    const taskId = randomUUID()
    await seedLease(workspaceRoot, taskId)

    writeBoulderState(workspaceRoot, {
      active_plan: join(workspaceRoot, ".sisyphus", "plans", "test.md"),
      started_at: new Date().toISOString(),
      session_ids: ["ses-owner"],
      plan_name: "test",
      governance_lease_task_id: taskId,
    })

    const hook = createTaskHealthHook({ directory: workspaceRoot } as PluginInput)
    const afterHook = hook["tool.execute.after"]
    if (!afterHook) throw new Error("task-health tool.execute.after is not registered")

    await afterHook(
      { tool: "background_output", sessionID: "ses-intruder", callID: "call-bg-flow-1" },
      { title: "background_output", output: '{"task_id":"bg_123"}', metadata: {} },
    )

    const block = await buildGovernanceDecisionAlertBlock({ directory: workspaceRoot } as PluginInput)
    expect(block).toContain("Governance Decision Alerts")
    expect(block).toContain("LEASE_REJECTED")
    expect(block).toContain("lease_rejected:1")
  })

  test("shows LEASE_REJECTED from task_reconcile nack mismatch", async () => {
    const taskId = randomUUID()
    await seedLease(workspaceRoot, taskId)

    writeBoulderState(workspaceRoot, {
      active_plan: join(workspaceRoot, ".sisyphus", "plans", "test.md"),
      started_at: new Date().toISOString(),
      session_ids: ["ses-owner"],
      plan_name: "test",
      governance_lease_task_id: taskId,
    })

    const taskStorage = join(workspaceRoot, ".tmp-runtime-flow-task-store")
    mkdirSync(taskStorage, { recursive: true })
    const staleTask: TaskObject = {
      id: `T-${randomUUID()}`,
      subject: "stale runtime flow task",
      description: "stale runtime flow task",
      status: "pending",
      blocks: [],
      blockedBy: [],
      threadID: "ses-intruder",
      metadata: { createdAtMs: 0 },
    }
    writeFileSync(join(taskStorage, `${staleTask.id}.json`), JSON.stringify(staleTask), "utf8")

    const reconcileTool = createTaskReconcileTool(
      { sisyphus: { tasks: { storage_path: taskStorage, claude_code_compat: false } } },
      { directory: workspaceRoot } as PluginInput,
    )
    const context: ToolContext = {
      sessionID: "ses-intruder",
      messageID: "msg-runtime-flow-1",
      agent: "Sisyphus",
      directory: workspaceRoot,
      worktree: workspaceRoot,
      metadata: () => {},
      ask: async () => {},
      abort: new AbortController().signal,
    }

    const result = JSON.parse(await reconcileTool.execute({ operation: "clean_orphans" }, context)) as {
      orphansCleaned?: number
    }
    expect(result.orphansCleaned).toBe(1)

    const block = await buildGovernanceDecisionAlertBlock({ directory: workspaceRoot } as PluginInput)
    expect(block).toContain("Governance Decision Alerts")
    expect(block).toContain("LEASE_REJECTED")
    expect(block).toContain("lease_rejected:1")
  })
})
