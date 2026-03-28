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

function mockFetchSequence(responses: Response[]): { restore: () => void; callCount: () => number } {
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
    callCount: () => count,
  }
}

describe("start-work gated hook governance guardrails", () => {
  let directory: string
  let planPath: string

  beforeEach(() => {
    directory = join(tmpdir(), `start-work-guardrails-${randomUUID()}`)
    mkdirSync(join(directory, ".sisyphus", "plans"), { recursive: true })
    mkdirSync(join(directory, ".opencode"), { recursive: true })
    planPath = join(directory, ".sisyphus", "plans", "guardrails-plan.md")
    writeFileSync(planPath, "# Plan\n- [ ] task", "utf8")
    writeBoulderState(directory, {
      active_plan: planPath,
      started_at: new Date().toISOString(),
      session_ids: ["ses-main"],
      plan_name: "guardrails-plan",
    })
    _resetGovernanceSessionValidationForTesting()
  })

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true })
    delete process.env.GAIA_GOVERNANCE_PRECHECK_URL
    _resetGovernanceSessionValidationForTesting()
  })

  test("clears stale governance validation when precheck is skipped", async () => {
    markGovernanceSessionValidated("ses-main", "lease-old")

    const hook = createStartWorkHook({ directory } as PluginInput)
    const chatMessage = hook["chat.message"]
    if (!chatMessage) throw new Error("chat.message hook missing")

    await chatMessage(
      { sessionID: "ses-main" },
      { parts: [{ type: "text", text: "run /start-work" }] },
    )

    expect(isGovernanceSessionValidated("ses-main")).toBe(false)
  })

  test("does not fetch decision alerts when governance precheck fails", async () => {
    process.env.GAIA_GOVERNANCE_PRECHECK_URL = "http://127.0.0.1:8787"
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

      await chatMessage(
        { sessionID: "ses-main" },
        { parts: [{ type: "text", text: "run /start-work" }] },
      )

      expect(fetchMock.callCount()).toBe(1)
    } finally {
      fetchMock.restore()
    }
  })
})
