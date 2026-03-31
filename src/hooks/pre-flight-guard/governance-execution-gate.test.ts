/// <reference types="bun-types/test-globals" />

import { mkdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import type { PluginInput } from "@opencode-ai/plugin"
import { _resetForTesting, setSessionAgent, subagentSessions } from "../../features/claude-code-session-state"
import {
  _resetGovernanceSessionValidationForTesting,
  markGovernanceBootGateState,
  markGovernanceSessionValidated,
} from "../shared/governance-session-state"
import { createPreFlightGuardHook } from "./index"

function mockFetchSequence(responses: Response[]): { restore: () => void } {
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
  }
}

describe("pre-flight governance execution gate", () => {
  let directory: string

  beforeEach(() => {
    directory = join(tmpdir(), `pre-flight-governance-${randomUUID()}`)
    mkdirSync(directory, { recursive: true })
    process.env.GAIA_GOVERNANCE_PRECHECK_URL = "http://127.0.0.1:8787"
    _resetGovernanceSessionValidationForTesting()
    subagentSessions.clear()
    _resetForTesting()
  })

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true })
    delete process.env.GAIA_GOVERNANCE_PRECHECK_URL
    _resetGovernanceSessionValidationForTesting()
    subagentSessions.clear()
    _resetForTesting()
  })

  test("auto-runs governance precheck for Hephaestus session and allows execute on success", async () => {
    setSessionAgent("ses_hephaestus", "Hephaestus (Deep Agent)")
    const fetchMock = mockFetchSequence([
      {
        ok: true,
        json: async () => ({
          ok: true,
          policy: { version: "runtime-policy-2026-03-27.v2", fingerprint: "fp-1", providerCount: 4 },
        }),
      } as Response,
      {
        ok: true,
        json: async () => ({ ok: true, issues: [] }),
      } as Response,
      {
        ok: true,
        json: async () => ({ ok: true }),
      } as Response,
    ])

    const hook = createPreFlightGuardHook({ directory } as PluginInput, { minReadBeforeExecute: 0 })
    const before = hook["tool.execute.before"]
    if (!before) throw new Error("tool.execute.before hook missing")

    try {
      await expect(
        before(
          { tool: "edit", sessionID: "ses_hephaestus", callID: "call-auto-1" },
          { args: { filePath: "src/main.ts" } },
        ),
      ).resolves.toBeUndefined()
    } finally {
      fetchMock.restore()
    }
  })

  test("auto-runs governance precheck for Sisyphus session and allows execute on success", async () => {
    setSessionAgent("ses_sisyphus", "Sisyphus (Ultraworker)")
    const fetchMock = mockFetchSequence([
      {
        ok: true,
        json: async () => ({
          ok: true,
          policy: { version: "runtime-policy-2026-03-27.v2", fingerprint: "fp-2", providerCount: 4 },
        }),
      } as Response,
      {
        ok: true,
        json: async () => ({ ok: true, issues: [] }),
      } as Response,
      {
        ok: true,
        json: async () => ({ ok: true }),
      } as Response,
    ])

    const hook = createPreFlightGuardHook({ directory } as PluginInput, { minReadBeforeExecute: 0 })
    const before = hook["tool.execute.before"]
    if (!before) throw new Error("tool.execute.before hook missing")

    try {
      await expect(
        before(
          { tool: "edit", sessionID: "ses_sisyphus", callID: "call-auto-2" },
          { args: { filePath: "src/main.ts" } },
        ),
      ).resolves.toBeUndefined()
    } finally {
      fetchMock.restore()
    }
  })

  test("blocks write execute tools when governance boot gate fails", async () => {
    const fetchMock = mockFetchSequence([{
      ok: false,
      json: async () => ({ ok: false }),
    } as Response])

    const hook = createPreFlightGuardHook({ directory } as PluginInput, { minReadBeforeExecute: 0 })
    const before = hook["tool.execute.before"]
    if (!before) throw new Error("tool.execute.before hook missing")

    try {
      await expect(
        before(
          { tool: "edit", sessionID: "ses_hephaestus", callID: "call-1" },
          { args: { filePath: "src/main.ts" } },
        ),
      ).rejects.toThrow("[🛑 Governance Boot Gate]")
    } finally {
      fetchMock.restore()
    }
  })

  test("allows write execute tools after governance precheck state is marked", async () => {
    markGovernanceSessionValidated("ses_sisyphus", "lease-task-001")
    markGovernanceBootGateState("ses_sisyphus", {
      status: "passed",
      checkedAt: Date.now(),
      policyVersion: "runtime-policy-2026-03-27.v2",
      policyFingerprint: "fp-cached",
    })

    const hook = createPreFlightGuardHook({ directory } as PluginInput, { minReadBeforeExecute: 0 })
    const before = hook["tool.execute.before"]
    if (!before) throw new Error("tool.execute.before hook missing")

    await expect(
      before(
        { tool: "edit", sessionID: "ses_sisyphus", callID: "call-2" },
        { args: { filePath: "src/main.ts" } },
      ),
    ).resolves.toBeUndefined()
  })

  test("does not block read-only bash commands when governance state is missing", async () => {
    const hook = createPreFlightGuardHook({ directory } as PluginInput, { minReadBeforeExecute: 0 })
    const before = hook["tool.execute.before"]
    if (!before) throw new Error("tool.execute.before hook missing")

    await expect(
      before(
        { tool: "bash", sessionID: "ses_oracle", callID: "call-3" },
        { args: { command: "git status" } },
      ),
    ).resolves.toBeUndefined()
  })

  test("skips governance block for subagent sessions", async () => {
    const sessionID = "ses_subagent"
    subagentSessions.add(sessionID)

    const hook = createPreFlightGuardHook({ directory } as PluginInput, { minReadBeforeExecute: 0 })
    const before = hook["tool.execute.before"]
    if (!before) throw new Error("tool.execute.before hook missing")

    await expect(
      before(
        { tool: "edit", sessionID, callID: "call-4" },
        { args: { filePath: "src/main.ts" } },
      ),
    ).resolves.toBeUndefined()
  })
})
