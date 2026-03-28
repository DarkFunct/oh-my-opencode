/// <reference types="bun-types/test-globals" />

import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { writeBoulderState } from "../../features/boulder-state"
import { runStartWorkPrecheckWithStatus } from "./pre-execution-precheck"

function mockFetchSequence(responses: Response[]): { restore: () => void; callCount: () => number } {
  const originalFetch = globalThis.fetch
  let count = 0
  const fallback = responses[responses.length - 1]

  const mockedFetch: typeof fetch = async () => {
    const next = responses[count] ?? fallback
    count += 1
    return next
  }

  globalThis.fetch = mockedFetch

  return {
    restore: () => {
      globalThis.fetch = originalFetch
    },
    callCount: () => count,
  }
}

describe("runStartWorkPrecheckWithStatus", () => {
  let testDir: string
  let planPath: string

  beforeEach(() => {
    testDir = join(tmpdir(), `start-work-precheck-status-${randomUUID()}`)
    mkdirSync(join(testDir, ".sisyphus", "plans"), { recursive: true })
    mkdirSync(join(testDir, ".opencode"), { recursive: true })
    planPath = join(testDir, ".sisyphus", "plans", "precheck-plan.md")
    writeFileSync(planPath, "# Plan\n- [ ] task", "utf8")
    writeBoulderState(testDir, {
      active_plan: planPath,
      started_at: new Date().toISOString(),
      session_ids: ["ses-1"],
      plan_name: "precheck-plan",
    })
    delete process.env.GAIA_GOVERNANCE_PRECHECK_URL
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
    delete process.env.GAIA_GOVERNANCE_PRECHECK_URL
  })

  test("returns skipped when governance endpoint is not configured", async () => {
    const result = await runStartWorkPrecheckWithStatus({ directory: testDir, sessionID: "ses-test" })
    expect(result).toEqual({ status: "skipped", failureBlock: null })
  })

  test("returns failed when governance precheck fails", async () => {
    process.env.GAIA_GOVERNANCE_PRECHECK_URL = "http://127.0.0.1:8787"
    const fetchMock = mockFetchSequence([{
      ok: false,
      json: async () => ({
        ok: false,
        issues: [{ code: "PLAN_REJECTED", message: "missing Evidence Facts section" }],
      }),
    } as Response])

    try {
      const result = await runStartWorkPrecheckWithStatus({ directory: testDir, sessionID: "ses-test" })
      expect(result.status).toBe("failed")
      expect(result.failureBlock).toContain("PLAN_REJECTED")
    } finally {
      fetchMock.restore()
    }
  })

  test("returns passed with lease task id when precheck and ack succeed", async () => {
    process.env.GAIA_GOVERNANCE_PRECHECK_URL = "http://127.0.0.1:8787"
    const fetchMock = mockFetchSequence([
      {
        ok: true,
        json: async () => ({ ok: true, issues: [] }),
      } as Response,
      {
        ok: true,
        json: async () => ({ ok: true }),
      } as Response,
    ])

    try {
      const result = await runStartWorkPrecheckWithStatus({ directory: testDir, sessionID: "ses-test" })
      expect(result.status).toBe("passed")
      expect(result.failureBlock).toBeNull()
      expect(result.leaseTaskId).toBeDefined()
      expect(fetchMock.callCount()).toBe(2)
    } finally {
      fetchMock.restore()
    }
  })
})
