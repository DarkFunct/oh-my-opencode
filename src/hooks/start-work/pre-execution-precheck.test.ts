/// <reference types="bun-types/test-globals" />

import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { readBoulderState, writeBoulderState } from "../../features/boulder-state"
import { runStartWorkPrecheck } from "./pre-execution-precheck"

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

describe("runStartWorkPrecheck", () => {
  let testDir: string
  let planPath: string

  beforeEach(() => {
    testDir = join(tmpdir(), `start-work-precheck-${randomUUID()}`)
    mkdirSync(join(testDir, ".sisyphus"), { recursive: true })
    mkdirSync(join(testDir, ".opencode"), { recursive: true })
    planPath = join(testDir, ".sisyphus", "plans", "precheck-plan.md")
    mkdirSync(join(testDir, ".sisyphus", "plans"), { recursive: true })
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

  test("returns null when precheck endpoint is not configured", async () => {
    const result = await runStartWorkPrecheck({ directory: testDir, sessionID: "ses-test" })
    expect(result).toBeNull()
  })

  test("returns reminder block when governance precheck fails", async () => {
    process.env.GAIA_GOVERNANCE_PRECHECK_URL = "http://127.0.0.1:8787"
    const fetchMock = mockFetchSequence([{
      ok: false,
      json: async () => ({
        ok: false,
        issues: [{ code: "PLAN_REJECTED", message: "missing Evidence Facts section" }],
      }),
    } as Response])

    try {
      const result = await runStartWorkPrecheck({ directory: testDir, sessionID: "ses-test" })
      expect(result).toContain("Pre-Execution Governance Gate Failed")
      expect(result).toContain("PLAN_REJECTED")
    } finally {
      fetchMock.restore()
    }
  })

  test("returns null when governance precheck passes", async () => {
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
      const result = await runStartWorkPrecheck({ directory: testDir, sessionID: "ses-test" })
      expect(result).toBeNull()
      expect(fetchMock.callCount()).toBe(2)
      const persisted = readBoulderState(testDir)
      expect(persisted?.governance_lease_task_id).toBeDefined()
    } finally {
      fetchMock.restore()
    }
  })

  test("returns reminder block when lease ack fails", async () => {
    process.env.GAIA_GOVERNANCE_PRECHECK_URL = "http://127.0.0.1:8787"
    const fetchMock = mockFetchSequence([
      {
        ok: true,
        json: async () => ({ ok: true, issues: [] }),
      } as Response,
      {
        ok: false,
        json: async () => ({ ok: false, error: "owner mismatch" }),
      } as Response,
    ])

    try {
      const result = await runStartWorkPrecheck({ directory: testDir, sessionID: "ses-test" })
      expect(result).toContain("LEASE_ACK_FAILED")
    } finally {
      fetchMock.restore()
    }
  })

  test("returns reminder block when decision log write fails", async () => {
    process.env.GAIA_GOVERNANCE_PRECHECK_URL = "http://127.0.0.1:8787"
    const fetchMock = mockFetchSequence([{
      ok: true,
      json: async () => ({ ok: true, issues: [], decisionLogWritten: false }),
    } as Response])

    try {
      const result = await runStartWorkPrecheck({ directory: testDir, sessionID: "ses-test" })
      expect(result).toContain("DECISION_LOG_WRITE_FAILED")
      expect(fetchMock.callCount()).toBe(1)
    } finally {
      fetchMock.restore()
    }
  })

  test("returns reminder block when decision log drifts", async () => {
    process.env.GAIA_GOVERNANCE_PRECHECK_URL = "http://127.0.0.1:8787"
    writeBoulderState(testDir, {
      active_plan: planPath,
      started_at: new Date().toISOString(),
      session_ids: ["ses-test"],
      plan_name: "precheck-plan",
      governance_lease_task_id: "lease-task-fixed",
    })
    mkdirSync(join(testDir, ".kgs", "governance"), { recursive: true })
    writeFileSync(
      join(testDir, ".kgs", "governance", "capability-decisions.jsonl"),
      JSON.stringify({
        outcome: "CAPABILITY_DENIED",
        role: "Atlas",
        requiredCapability: "project.verify",
        leaseTaskId: "lease-task-fixed",
        ownerSessionId: "ses-test",
      }) + "\n",
      "utf8",
    )

    const fetchMock = mockFetchSequence([
      {
        ok: true,
        json: async () => ({ ok: true, issues: [], decisionLogWritten: true }),
      } as Response,
      {
        ok: true,
        json: async () => ({ ok: true }),
      } as Response,
    ])

    try {
      const result = await runStartWorkPrecheck({ directory: testDir, sessionID: "ses-test" })
      expect(result).toContain("DECISION_OUTCOME_MISMATCH")
    } finally {
      fetchMock.restore()
    }
  })

  test("passes when decision log matches expected precheck result", async () => {
    process.env.GAIA_GOVERNANCE_PRECHECK_URL = "http://127.0.0.1:8787"
    writeBoulderState(testDir, {
      active_plan: planPath,
      started_at: new Date().toISOString(),
      session_ids: ["ses-test"],
      plan_name: "precheck-plan",
      governance_lease_task_id: "lease-task-fixed",
    })
    mkdirSync(join(testDir, ".kgs", "governance"), { recursive: true })
    writeFileSync(
      join(testDir, ".kgs", "governance", "capability-decisions.jsonl"),
      JSON.stringify({
        outcome: "ALLOWED",
        role: "Atlas",
        requiredCapability: "project.verify",
        leaseTaskId: "lease-task-fixed",
        ownerSessionId: "ses-test",
      }) + "\n",
      "utf8",
    )

    const fetchMock = mockFetchSequence([
      {
        ok: true,
        json: async () => ({ ok: true, issues: [], decisionLogWritten: true }),
      } as Response,
      {
        ok: true,
        json: async () => ({ ok: true }),
      } as Response,
    ])

    try {
      const result = await runStartWorkPrecheck({ directory: testDir, sessionID: "ses-test" })
      expect(result).toBeNull()
    } finally {
      fetchMock.restore()
    }
  })

  test("uses project start_work governance_precheck_url when env is not set", async () => {
    writeFileSync(
      join(testDir, ".opencode", "oh-my-opencode.json"),
      JSON.stringify({
        start_work: {
          governance_precheck_url: "http://127.0.0.1:8787",
        },
      }),
      "utf8",
    )

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
      const result = await runStartWorkPrecheck({ directory: testDir, sessionID: "ses-test" })
      expect(result).toBeNull()
      expect(fetchMock.callCount()).toBe(2)
    } finally {
      fetchMock.restore()
    }
  })

  test("reuses persisted lease task id on subsequent precheck calls", async () => {
    process.env.GAIA_GOVERNANCE_PRECHECK_URL = "http://127.0.0.1:8787"
    const fetchMock = mockFetchSequence([{
        ok: true,
        json: async () => ({ ok: true, issues: [] }),
      } as Response])

    try {
      await runStartWorkPrecheck({ directory: testDir, sessionID: "ses-test" })
      const first = readBoulderState(testDir)?.governance_lease_task_id
      await runStartWorkPrecheck({ directory: testDir, sessionID: "ses-test" })
      const second = readBoulderState(testDir)?.governance_lease_task_id

      expect(first).toBeDefined()
      expect(second).toBe(first)
    } finally {
      fetchMock.restore()
    }
  })
})
