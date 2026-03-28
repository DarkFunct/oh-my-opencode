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
import { createTaskHealthHook } from "../../hooks/task-health"
import { createTaskReconcileTool } from "./task-reconcile-tool"
import type { TaskObject } from "./types"

type AlertRecord = {
  outcome?: string
  leaseTaskId?: string
  ownerSessionId?: string
  requiredCapability?: string
  role?: string
}

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

async function readAlerts(router: ReturnType<typeof createGovernanceRoutes>, workspaceRoot: string): Promise<AlertRecord[]> {
  const response = await router.request("/decision/alerts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ workspaceRoot, includeAllowed: true, limit: 20 }),
  })

  expect(response.status).toBe(200)
  const body = await response.json() as { alerts: AlertRecord[] }
  return body.alerts
}

async function seedLease(workspaceRoot: string, taskId: string, ownerSessionId: string): Promise<void> {
  const manager = new TaskLeaseManager(new TaskLeaseFileStore(workspaceRoot))
  await manager.acquire({
    taskId,
    ownerSessionId,
    ownerRole: "Sisyphus-Junior",
    requiredCapability: "project.modify",
    ttlMs: 60_000,
  })
}

describe("cross-repo governance lease rejection alerts", () => {
  let workspaceRoot: string
  let baseUrl: string
  let restoreFetch: (() => void) | null
  let router: ReturnType<typeof createGovernanceRoutes>

  beforeEach(async () => {
    workspaceRoot = join(tmpdir(), `governance-lease-alert-e2e-${randomUUID()}`)
    mkdirSync(join(workspaceRoot, ".opencode"), { recursive: true })
    mkdirSync(join(workspaceRoot, ".sisyphus", "plans"), { recursive: true })
    writeFileSync(join(workspaceRoot, ".sisyphus", "plans", "test.md"), "# plan\n", "utf8")

    baseUrl = `http://gaia-e2e-${randomUUID()}.local`
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

  test("background_output heartbeat rejection is visible in decision alerts", async () => {
    const taskId = randomUUID()
    await seedLease(workspaceRoot, taskId, "ses-owner")

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
      { tool: "background_output", sessionID: "ses-intruder", callID: "call-bg-1" },
      { title: "background_output", output: '{"task_id":"bg_123"}', metadata: {} },
    )

    const alerts = await readAlerts(router, workspaceRoot)
    const leaseRejected = alerts.find((record) => record.outcome === "LEASE_REJECTED" && record.ownerSessionId === "ses-intruder")

    expect(leaseRejected).toBeDefined()
    expect(leaseRejected?.leaseTaskId).toBe(taskId)
    expect(leaseRejected?.requiredCapability).toBe("project.modify")
    expect(leaseRejected?.role).toBe("Sisyphus-Junior")
  })

  test("task_reconcile nack rejection is visible in decision alerts", async () => {
    const taskId = randomUUID()
    await seedLease(workspaceRoot, taskId, "ses-owner")

    writeBoulderState(workspaceRoot, {
      active_plan: join(workspaceRoot, ".sisyphus", "plans", "test.md"),
      started_at: new Date().toISOString(),
      session_ids: ["ses-owner"],
      plan_name: "test",
      governance_lease_task_id: taskId,
    })

    const taskStorage = join(workspaceRoot, ".tmp-task-reconcile-store")
    mkdirSync(taskStorage, { recursive: true })
    const staleTask: TaskObject = {
      id: `T-${randomUUID()}`,
      subject: "stale task",
      description: "stale task",
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
      messageID: "msg-reconcile-1",
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

    const alerts = await readAlerts(router, workspaceRoot)
    const leaseRejected = alerts.find((record) => record.outcome === "LEASE_REJECTED" && record.ownerSessionId === "ses-intruder")

    expect(leaseRejected).toBeDefined()
    expect(leaseRejected?.leaseTaskId).toBe(taskId)
    expect(leaseRejected?.requiredCapability).toBe("project.modify")
  })
})
