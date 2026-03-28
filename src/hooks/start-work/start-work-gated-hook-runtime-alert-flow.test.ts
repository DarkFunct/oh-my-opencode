declare const require: (name: string) => any
const { afterEach, beforeEach, describe, expect, test } = require("bun:test")

import type { PluginInput } from "@opencode-ai/plugin"
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
import { createStartWorkHook } from "./start-work-gated-hook"

function installGovernanceFetchProxy(baseUrl: string, router: ReturnType<typeof createGovernanceRoutes>): () => void {
  const originalFetch = globalThis.fetch
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "")

  const mockedFetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const targetUrl = new URL(String(input))
    if (targetUrl.origin !== normalizedBaseUrl) {
      return originalFetch(input, init)
    }

    const routePath = `${targetUrl.pathname}${targetUrl.search}`.replace("/api/v1/governance", "") || "/"
    if (routePath === "/execute/precheck") {
      return new Response(JSON.stringify({ ok: true, issues: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    }

    if (routePath === "/lease/ack") {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    }

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

describe("start-work gated hook runtime alert flow", () => {
  let workspaceRoot: string
  let baseUrl: string
  let restoreFetch: (() => void) | null

  beforeEach(async () => {
    workspaceRoot = join(tmpdir(), `start-work-gated-runtime-alert-${randomUUID()}`)
    mkdirSync(join(workspaceRoot, ".opencode"), { recursive: true })
    mkdirSync(join(workspaceRoot, ".sisyphus", "plans"), { recursive: true })

    baseUrl = `http://gaia-start-work-flow-${randomUUID()}.local`
    writeFileSync(
      join(workspaceRoot, ".opencode", "oh-my-opencode.json"),
      JSON.stringify({
        start_work: {
          governance_precheck_url: baseUrl,
        },
      }),
      "utf8",
    )

    const taskId = randomUUID()
    const planPath = join(workspaceRoot, ".sisyphus", "plans", "active-plan.md")
    writeFileSync(planPath, "# plan\n- [ ] task\n", "utf8")
    writeBoulderState(workspaceRoot, {
      active_plan: planPath,
      started_at: new Date().toISOString(),
      session_ids: ["ses-owner"],
      plan_name: "active-plan",
      governance_lease_task_id: taskId,
    })

    const router = createGovernanceRoutes()
    restoreFetch = installGovernanceFetchProxy(baseUrl, router)
    await seedLease(workspaceRoot, taskId)

    const taskHealthHook = createTaskHealthHook({ directory: workspaceRoot } as PluginInput)
    const afterHook = taskHealthHook["tool.execute.after"]
    if (!afterHook) {
      throw new Error("task-health tool.execute.after is not registered")
    }

    await afterHook(
      { tool: "background_output", sessionID: "ses-intruder", callID: "call-runtime-flow" },
      { title: "background_output", output: '{"task_id":"bg_123"}', metadata: {} },
    )
  })

  afterEach(() => {
    restoreFetch?.()
    restoreFetch = null
    rmSync(workspaceRoot, { recursive: true, force: true })
  })

  test("injects LEASE_REJECTED decision alert into start-work output", async () => {
    const hook = createStartWorkHook({ directory: workspaceRoot } as PluginInput)
    const chatMessage = hook["chat.message"]
    if (!chatMessage) {
      throw new Error("chat.message hook missing")
    }

    const output = { parts: [{ type: "text", text: "run /start-work" }] }
    await chatMessage({ sessionID: "ses-main" }, output)

    const text = String(output.parts[0]?.text ?? "")
    expect(text).toContain("Governance Decision Alerts")
    expect(text).toContain("LEASE_REJECTED")
    expect(text).toContain("lease_rejected:1")
    expect(text).toContain("Top roles: Sisyphus-Junior:1")
    expect(text).toContain("Top sessions: ses-intruder:1")
  })
})
