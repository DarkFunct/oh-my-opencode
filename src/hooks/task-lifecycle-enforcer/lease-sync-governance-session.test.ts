import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import {
  _resetGovernanceSessionValidationForTesting,
  markGovernanceSessionValidated,
} from "../shared/governance-session-state"
import { syncTaskLeaseSignal } from "./lease-sync"

function mockFetchConstant(response: Response): {
  restore: () => void
  calls: () => Array<{ url: string; init: RequestInit | undefined }>
} {
  const originalFetch = globalThis.fetch
  const records: Array<{ url: string; init: RequestInit | undefined }> = []

  const mockedFetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
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

describe("syncTaskLeaseSignal governance session fallback", () => {
  let directory: string

  beforeEach(() => {
    directory = join(tmpdir(), `lease-sync-gov-session-${randomUUID()}`)
    mkdirSync(join(directory, ".opencode"), { recursive: true })
    writeFileSync(
      join(directory, ".opencode", "oh-my-opencode.json"),
      JSON.stringify({
        start_work: {
          governance_precheck_url: "http://127.0.0.1:8787",
        },
      }),
      "utf8",
    )
    _resetGovernanceSessionValidationForTesting()
  })

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true })
    _resetGovernanceSessionValidationForTesting()
  })

  test("uses governance session lease task id when boulder lease id is absent", async () => {
    markGovernanceSessionValidated("ses-gov", "lease-session-001")
    const fetchMock = mockFetchConstant({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    } as Response)

    try {
      await syncTaskLeaseSignal({
        directory,
        sessionID: "ses-gov",
        action: "heartbeat",
        taskId: "T-100",
      })

      expect(fetchMock.calls().length).toBe(1)
      const firstCall = fetchMock.calls()[0]
      expect(firstCall.url).toContain("/api/v1/governance/lease/heartbeat")
      const body = JSON.parse(String(firstCall.init?.body)) as {
        taskId: string
        ownerSessionId: string
        workspaceRoot: string
      }
      expect(body.taskId).toBe("lease-session-001")
      expect(body.ownerSessionId).toBe("ses-gov")
      expect(body.workspaceRoot).toBe(directory)
    } finally {
      fetchMock.restore()
    }
  })
})
