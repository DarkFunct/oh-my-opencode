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

describe("governance alert panel cross-repo visibility", () => {
  let workspaceRoot: string
  let baseUrl: string
  let restoreFetch: (() => void) | null
  let router: ReturnType<typeof createGovernanceRoutes>

  beforeEach(() => {
    workspaceRoot = join(tmpdir(), `governance-alert-panel-e2e-${randomUUID()}`)
    mkdirSync(join(workspaceRoot, ".opencode"), { recursive: true })

    baseUrl = `http://gaia-alerts-${randomUUID()}.local`
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

  test("renders LEASE_REJECTED from real Gaia decision alerts route", async () => {
    const taskId = randomUUID()
    await seedLease(workspaceRoot, taskId)

    const rejectResponse = await router.request("/lease/heartbeat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceRoot,
        taskId,
        ownerSessionId: "ses-intruder",
        ttlMs: 60_000,
      }),
    })
    expect(rejectResponse.status).toBe(409)

    const block = await buildGovernanceDecisionAlertBlock({ directory: workspaceRoot } as PluginInput)

    expect(block).toContain("Governance Decision Alerts")
    expect(block).toContain("LEASE_REJECTED")
    expect(block).toContain("lease_rejected:1")
    expect(block).toContain("Top roles: Sisyphus-Junior:1")
    expect(block).toContain("Top sessions: ses-intruder:1")
  })
})
