declare const require: (name: string) => any
const { afterEach, describe, expect, test } = require("bun:test")
import type { PluginInput } from "@opencode-ai/plugin"
import { buildGovernanceDecisionAlertBlock } from "./governance-alert-panel"

function mockFetchSequence(responses: Response[]): { restore: () => void } {
  const originalFetch = globalThis.fetch
  let count = 0
  const fallback = responses[responses.length - 1]

  const mockedFetch = (async () => {
    const next = responses[count] ?? fallback
    count += 1
    return next
  }) as unknown as typeof fetch

  globalThis.fetch = mockedFetch
  return {
    restore: () => {
      globalThis.fetch = originalFetch
    },
  }
}

describe("buildGovernanceDecisionAlertBlock", () => {
  afterEach(() => {
    delete process.env.GAIA_GOVERNANCE_PRECHECK_URL
  })

  test("returns null when governance endpoint is not configured", async () => {
    const block = await buildGovernanceDecisionAlertBlock({ directory: "/tmp" } as PluginInput)
    expect(block).toBeNull()
  })

  test("returns alert block when governance decision alerts exist", async () => {
    process.env.GAIA_GOVERNANCE_PRECHECK_URL = "http://127.0.0.1:8787"
    const fetchMock = mockFetchSequence([{
      ok: true,
      json: async () => ({
        ok: true,
        summary: {
          total: 1,
          allowed: 0,
          planRejected: 0,
          capabilityDenied: 1,
          leaseRejected: 0,
        },
        alerts: [{
          workspaceRoot: "/tmp",
          role: "Atlas",
          requiredCapability: "project.verify",
          outcome: "CAPABILITY_DENIED",
          issues: [{ code: "CAPABILITY_DENIED", message: "missing role capability" }],
        }],
        parseErrors: 0,
        totalLines: 1,
        scannedRecords: 1,
        truncated: false,
        returnedRecords: 1,
        appliedLimit: 5,
      }),
    } as Response])

    try {
      const block = await buildGovernanceDecisionAlertBlock({ directory: "/tmp" } as PluginInput)
      expect(block).toContain("Governance Decision Alerts")
      expect(block).toContain("CAPABILITY_DENIED")
    } finally {
      fetchMock.restore()
    }
  })

  test("returns null when there are no alerts and no parse errors", async () => {
    process.env.GAIA_GOVERNANCE_PRECHECK_URL = "http://127.0.0.1:8787"
    const fetchMock = mockFetchSequence([{
      ok: true,
      json: async () => ({
        ok: true,
        summary: {
          total: 0,
          allowed: 0,
          planRejected: 0,
          capabilityDenied: 0,
          leaseRejected: 0,
        },
        alerts: [],
        parseErrors: 0,
        totalLines: 0,
        scannedRecords: 0,
        truncated: false,
        returnedRecords: 0,
        appliedLimit: 5,
      }),
    } as Response])

    try {
      const block = await buildGovernanceDecisionAlertBlock({ directory: "/tmp" } as PluginInput)
      expect(block).toBeNull()
    } finally {
      fetchMock.restore()
    }
  })

  test("returns alert block when parse errors exist even without alert records", async () => {
    process.env.GAIA_GOVERNANCE_PRECHECK_URL = "http://127.0.0.1:8787"
    const fetchMock = mockFetchSequence([{
      ok: true,
      json: async () => ({
        ok: true,
        summary: {
          total: 0,
          allowed: 0,
          planRejected: 0,
          capabilityDenied: 0,
          leaseRejected: 0,
        },
        alerts: [],
        parseErrors: 2,
        totalLines: 2,
        scannedRecords: 0,
        truncated: false,
        returnedRecords: 0,
        appliedLimit: 5,
      }),
    } as Response])

    try {
      const block = await buildGovernanceDecisionAlertBlock({ directory: "/tmp" } as PluginInput)
      expect(block).toContain("Governance Decision Alerts")
      expect(block).toContain("parse_errors:2")
    } finally {
      fetchMock.restore()
    }
  })

  test("returns null when alerts endpoint request fails", async () => {
    process.env.GAIA_GOVERNANCE_PRECHECK_URL = "http://127.0.0.1:8787"
    const fetchMock = mockFetchSequence([{
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "server exploded",
    } as Response])

    try {
      const block = await buildGovernanceDecisionAlertBlock({ directory: "/tmp" } as PluginInput)
      expect(block).toBeNull()
    } finally {
      fetchMock.restore()
    }
  })

  test("returns null when global fetch is unavailable", async () => {
    process.env.GAIA_GOVERNANCE_PRECHECK_URL = "http://127.0.0.1:8787"
    const originalFetch = globalThis.fetch
    Object.defineProperty(globalThis, "fetch", {
      value: undefined,
      configurable: true,
      writable: true,
    })

    try {
      const block = await buildGovernanceDecisionAlertBlock({ directory: "/tmp" } as PluginInput)
      expect(block).toBeNull()
    } finally {
      Object.defineProperty(globalThis, "fetch", {
        value: originalFetch,
        configurable: true,
        writable: true,
      })
    }
  })
})
