/// <reference types="bun-types/test-globals" />

import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { writeBoulderState } from "../../features/boulder-state"
import { syncTaskLeaseSignal } from "./lease-sync"

function mockFetchConstant(response: Response): {
  restore: () => void
  calls: () => Array<{ url: string; init: RequestInit | undefined }>
} {
  const originalFetch = globalThis.fetch
  const records: Array<{ url: string; init: RequestInit | undefined }> = []

  const mockedFetch: typeof fetch = async (input, init) => {
    records.push({ url: String(input), init })
    return response
  }

  globalThis.fetch = mockedFetch

  return {
    restore: () => {
      globalThis.fetch = originalFetch
    },
    calls: () => records,
  }
}

describe("syncTaskLeaseSignal", () => {
  let testDir: string

  beforeEach(() => {
    testDir = join(tmpdir(), `task-lease-sync-${randomUUID()}`)
    mkdirSync(join(testDir, ".opencode"), { recursive: true })
    mkdirSync(join(testDir, ".sisyphus"), { recursive: true })
    writeFileSync(
      join(testDir, ".opencode", "oh-my-opencode.json"),
      JSON.stringify({
        start_work: {
          governance_precheck_url: "http://127.0.0.1:8787",
        },
      }),
      "utf8",
    )
    writeBoulderState(testDir, {
      active_plan: join(testDir, ".sisyphus", "plans", "p.md"),
      started_at: new Date().toISOString(),
      session_ids: ["ses-a"],
      plan_name: "p",
      governance_lease_task_id: "lease-001",
    })
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
    delete process.env.GAIA_GOVERNANCE_PRECHECK_URL
  })

  test("sends heartbeat signal to Gaia lease route", async () => {
    const fetchMock = mockFetchConstant({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    } as Response)

    try {
      await syncTaskLeaseSignal({
        directory: testDir,
        sessionID: "ses-a",
        action: "heartbeat",
        taskId: "T-1",
      })

      expect(fetchMock.calls().length).toBe(1)
      const firstCall = fetchMock.calls()[0]
      expect(firstCall.url).toContain("/api/v1/governance/lease/heartbeat")
      const body = JSON.parse(String(firstCall.init?.body)) as {
        taskId: string
        ownerSessionId: string
        workspaceRoot: string
      }
      expect(body.taskId).toBe("lease-001")
      expect(body.ownerSessionId).toBe("ses-a")
      expect(body.workspaceRoot).toBe(testDir)
    } finally {
      fetchMock.restore()
    }
  })

  test("uses worktree_path as workspaceRoot when boulder worktree exists", async () => {
    const worktreePath = join(testDir, "worktrees", "feature-a")
    mkdirSync(worktreePath, { recursive: true })
    writeBoulderState(testDir, {
      active_plan: join(testDir, ".sisyphus", "plans", "p.md"),
      started_at: new Date().toISOString(),
      session_ids: ["ses-a"],
      plan_name: "p",
      governance_lease_task_id: "lease-001",
      worktree_path: worktreePath,
    })

    const fetchMock = mockFetchConstant({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    } as Response)

    try {
      await syncTaskLeaseSignal({
        directory: testDir,
        sessionID: "ses-a",
        action: "heartbeat",
        taskId: "T-1",
      })

      expect(fetchMock.calls().length).toBe(1)
      const firstCall = fetchMock.calls()[0]
      const body = JSON.parse(String(firstCall.init?.body)) as { workspaceRoot: string }
      expect(body.workspaceRoot).toBe(worktreePath)
    } finally {
      fetchMock.restore()
    }
  })

  test("sends nack signal with reason", async () => {
    const fetchMock = mockFetchConstant({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    } as Response)

    try {
      await syncTaskLeaseSignal({
        directory: testDir,
        sessionID: "ses-a",
        action: "nack",
        reason: "todo-sync-failed",
        taskId: "T-2",
      })

      expect(fetchMock.calls().length).toBe(1)
      const firstCall = fetchMock.calls()[0]
      expect(firstCall.url).toContain("/api/v1/governance/lease/nack")
      const body = JSON.parse(String(firstCall.init?.body)) as { reason: string }
      expect(body.reason).toBe("todo-sync-failed")
    } finally {
      fetchMock.restore()
    }
  })

  test("skips signaling when endpoint is not configured", async () => {
    writeFileSync(join(testDir, ".opencode", "oh-my-opencode.json"), JSON.stringify({ start_work: {} }), "utf8")
    const fetchMock = mockFetchConstant({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    } as Response)

    try {
      await syncTaskLeaseSignal({
        directory: testDir,
        sessionID: "ses-a",
        action: "heartbeat",
        taskId: "T-3",
      })

      expect(fetchMock.calls().length).toBe(0)
    } finally {
      fetchMock.restore()
    }
  })
})
