/// <reference types="bun-types/test-globals" />

import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { writeBoulderState } from "../../features/boulder-state"
import { notifyTodoSyncLease } from "./todo-sync-lease"

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

describe("notifyTodoSyncLease", () => {
  let testDir: string
  let ctx: { directory: string }

  beforeEach(() => {
    testDir = join(tmpdir(), `todo-sync-lease-${randomUUID()}`)
    ctx = { directory: testDir }
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
      session_ids: ["ses-1"],
      plan_name: "p",
      governance_lease_task_id: "lease-todo-001",
    })
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  test("sends ack signal for successful todo sync", async () => {
    const fetchMock = mockFetchConstant({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    } as Response)

    try {
      await notifyTodoSyncLease({
        ctx,
        sessionID: "ses-1",
        action: "ack",
      })

      expect(fetchMock.calls().length).toBe(1)
      const firstCall = fetchMock.calls()[0]
      expect(firstCall.url).toContain("/api/v1/governance/lease/ack")
      const body = JSON.parse(String(firstCall.init?.body)) as { taskId: string; workspaceRoot: string }
      expect(body.taskId).toBe("lease-todo-001")
      expect(body.workspaceRoot).toBe(testDir)
    } finally {
      fetchMock.restore()
    }
  })

  test("sends nack signal when sync fails", async () => {
    const fetchMock = mockFetchConstant({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    } as Response)

    try {
      await notifyTodoSyncLease({
        ctx,
        sessionID: "ses-1",
        action: "nack",
        reason: "todo-sync-timeout",
      })

      expect(fetchMock.calls().length).toBe(1)
      const firstCall = fetchMock.calls()[0]
      expect(firstCall.url).toContain("/api/v1/governance/lease/nack")
      const body = JSON.parse(String(firstCall.init?.body)) as { reason: string; workspaceRoot: string }
      expect(body.reason).toBe("todo-sync-timeout")
      expect(body.workspaceRoot).toBe(testDir)
    } finally {
      fetchMock.restore()
    }
  })

  test("uses boulder worktree_path as workspaceRoot when present", async () => {
    const worktreePath = join(testDir, "worktrees", "feature-a")
    mkdirSync(worktreePath, { recursive: true })
    writeBoulderState(testDir, {
      active_plan: join(testDir, ".sisyphus", "plans", "p.md"),
      started_at: new Date().toISOString(),
      session_ids: ["ses-1"],
      plan_name: "p",
      governance_lease_task_id: "lease-todo-001",
      worktree_path: worktreePath,
    })

    const fetchMock = mockFetchConstant({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    } as Response)

    try {
      await notifyTodoSyncLease({
        ctx,
        sessionID: "ses-1",
        action: "ack",
      })

      expect(fetchMock.calls().length).toBe(1)
      const body = JSON.parse(String(fetchMock.calls()[0].init?.body)) as { workspaceRoot: string }
      expect(body.workspaceRoot).toBe(worktreePath)
    } finally {
      fetchMock.restore()
    }
  })
})
