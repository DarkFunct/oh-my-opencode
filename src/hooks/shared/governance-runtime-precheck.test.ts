/// <reference types="bun-types/test-globals" />

import { mkdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import {
  _resetGovernanceSessionValidationForTesting,
  getGovernanceSessionLeaseTaskId,
  isGovernanceSessionValidated,
} from "./governance-session-state"
import { runRuntimeGovernancePrecheck } from "./governance-runtime-precheck"

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

describe("runRuntimeGovernancePrecheck", () => {
  let directory: string

  beforeEach(() => {
    directory = join(tmpdir(), `runtime-governance-${randomUUID()}`)
    mkdirSync(directory, { recursive: true })
    _resetGovernanceSessionValidationForTesting()
    delete process.env.GAIA_GOVERNANCE_PRECHECK_URL
  })

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true })
    _resetGovernanceSessionValidationForTesting()
    delete process.env.GAIA_GOVERNANCE_PRECHECK_URL
  })

  test("returns skipped when governance endpoint is not configured", async () => {
    const result = await runRuntimeGovernancePrecheck({
      directory,
      sessionID: "ses-runtime",
      agent: "Hephaestus",
      tool: "edit",
      args: { filePath: "src/main.ts" },
    })

    expect(result).toEqual({ status: "skipped", message: null })
  })

  test("returns failed when Gaia precheck rejects runtime payload", async () => {
    process.env.GAIA_GOVERNANCE_PRECHECK_URL = "http://127.0.0.1:8787"
    const fetchMock = mockFetchSequence([{
      ok: false,
      json: async () => ({
        ok: false,
        issues: [{ code: "PLAN_REJECTED", message: "schema invalid" }],
      }),
    } as Response])

    try {
      const result = await runRuntimeGovernancePrecheck({
        directory,
        sessionID: "ses-runtime",
        agent: "Hephaestus",
        tool: "edit",
        args: { filePath: "src/main.ts" },
      })

      expect(result.status).toBe("failed")
      expect(result.message).toContain("PLAN_REJECTED")
    } finally {
      fetchMock.restore()
    }
  })

  test("returns passed and persists session validation after precheck and ack", async () => {
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
      const result = await runRuntimeGovernancePrecheck({
        directory,
        sessionID: "ses-runtime",
        agent: "Hephaestus",
        tool: "edit",
        args: { filePath: "src/main.ts" },
      })

      expect(result.status).toBe("passed")
      expect(result.leaseTaskId).toBeDefined()
      expect(isGovernanceSessionValidated("ses-runtime")).toBe(true)
      expect(getGovernanceSessionLeaseTaskId("ses-runtime")).toBe(result.leaseTaskId)
      expect(fetchMock.callCount()).toBe(2)
    } finally {
      fetchMock.restore()
    }
  })
})
