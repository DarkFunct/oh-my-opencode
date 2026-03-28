import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import type { PluginInput } from "@opencode-ai/plugin"
import { writeBoulderState } from "../../features/boulder-state"
import {
  _resetGovernanceSessionValidationForTesting,
  isGovernanceSessionValidated,
  markGovernanceSessionValidated,
} from "../shared/governance-session-state"
import { createStartWorkHook } from "./start-work-gated-hook"

function mockFetchSequence(responses: Response[]): { restore: () => void } {
  const originalFetch = globalThis.fetch
  let count = 0
  const fallback = responses[responses.length - 1]

  const mockedFetch: typeof fetch = Object.assign(
    async () => {
      const next = responses[count] ?? fallback
      count += 1
      return next
    },
    {
      preconnect: originalFetch.preconnect?.bind(originalFetch),
    },
  )

  globalThis.fetch = mockedFetch
  return {
    restore: () => {
      globalThis.fetch = originalFetch
    },
  }
}

describe("start-work gated hook governance session state", () => {
  let directory: string
  let planPath: string

  beforeEach(() => {
    directory = join(tmpdir(), `start-work-gated-state-${randomUUID()}`)
    mkdirSync(join(directory, ".sisyphus", "plans"), { recursive: true })
    mkdirSync(join(directory, ".opencode"), { recursive: true })
    planPath = join(directory, ".sisyphus", "plans", "active-plan.md")
    writeFileSync(planPath, "# Plan\n- [ ] task", "utf8")
    writeBoulderState(directory, {
      active_plan: planPath,
      started_at: new Date().toISOString(),
      session_ids: ["ses-main"],
      plan_name: "active-plan",
    })
    process.env.GAIA_GOVERNANCE_PRECHECK_URL = "http://127.0.0.1:8787"
    _resetGovernanceSessionValidationForTesting()
  })

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true })
    delete process.env.GAIA_GOVERNANCE_PRECHECK_URL
    _resetGovernanceSessionValidationForTesting()
  })

  test("marks session validated after successful start-work precheck", async () => {
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
      const hook = createStartWorkHook({ directory } as PluginInput)
      const chatMessage = hook["chat.message"]
      if (!chatMessage) throw new Error("chat.message hook missing")

      await chatMessage(
        { sessionID: "ses-main" },
        { parts: [{ type: "text", text: "run /start-work" }] },
      )

      expect(isGovernanceSessionValidated("ses-main")).toBe(true)
    } finally {
      fetchMock.restore()
    }
  })

  test("clears session validation when start-work precheck fails", async () => {
    markGovernanceSessionValidated("ses-main", "lease-old")
    const fetchMock = mockFetchSequence([{
      ok: false,
      json: async () => ({
        ok: false,
        issues: [{ code: "PLAN_REJECTED", message: "missing Evidence Facts section" }],
      }),
    } as Response])

    try {
      const hook = createStartWorkHook({ directory } as PluginInput)
      const chatMessage = hook["chat.message"]
      if (!chatMessage) throw new Error("chat.message hook missing")

      const output = { parts: [{ type: "text", text: "run /start-work" }] }
      await chatMessage({ sessionID: "ses-main" }, output)

      expect(isGovernanceSessionValidated("ses-main")).toBe(false)
      expect(String(output.parts[0]?.text ?? "")).toContain("Pre-Execution Governance Gate Failed")
    } finally {
      fetchMock.restore()
    }
  })

  test("appends governance decision alert block when alerts are returned", async () => {
    const fetchMock = mockFetchSequence([
      {
        ok: true,
        json: async () => ({ ok: true, issues: [] }),
      } as Response,
      {
        ok: true,
        json: async () => ({ ok: true }),
      } as Response,
      {
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
            workspaceRoot: directory,
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
      } as Response,
    ])

    try {
      const hook = createStartWorkHook({ directory } as PluginInput)
      const chatMessage = hook["chat.message"]
      if (!chatMessage) throw new Error("chat.message hook missing")

      const output = { parts: [{ type: "text", text: "run /start-work" }] }
      await chatMessage({ sessionID: "ses-main" }, output)

      const text = String(output.parts[0]?.text ?? "")
      expect(text).toContain("Governance Decision Alerts")
      expect(text).toContain("CAPABILITY_DENIED")
    } finally {
      fetchMock.restore()
    }
  })
})
