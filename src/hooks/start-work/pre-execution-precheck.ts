import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { readBoulderState, writeBoulderState } from "../../features/boulder-state"
import type { BoulderState } from "../../features/boulder-state"
import { log } from "../../shared/logger"
import {
  fetchWithTimeout,
  governanceEndpoint,
  resolveGovernancePrecheckConfig,
} from "../shared/governance-precheck-config"
import {
  detectDecisionDrift,
  readLatestCapabilityDecision,
} from "./capability-decision-audit"

export interface StartWorkPrecheckInput {
  directory: string
  sessionID: string
}

export type StartWorkPrecheckStatus = "passed" | "failed" | "skipped"

export interface StartWorkPrecheckResult {
  status: StartWorkPrecheckStatus
  failureBlock: string | null
  leaseTaskId?: string
}

interface PrecheckIssue {
  code: string
  message: string
}

interface PrecheckResponse {
  ok: boolean
  issues: PrecheckIssue[]
  decisionLogWritten?: boolean
}

interface LeaseAckResponse {
  ok?: boolean
  error?: string
}

function ensureLeaseTaskId(directory: string, state: BoulderState): string {
  const existing = state.governance_lease_task_id?.trim()
  if (existing) return existing

  const created = randomUUID()
  writeBoulderState(directory, {
    ...state,
    governance_lease_task_id: created,
  })
  return created
}

function buildFailureBlock(issues: PrecheckIssue[]): string {
  const issueText = issues.map((issue) => `- ${issue.code}: ${issue.message}`).join("\n")
  return [
    "<system-reminder>",
    "## Pre-Execution Governance Gate Failed",
    "",
    "Do NOT execute plan tasks yet. Return to planning/review and fix the following gate issues:",
    issueText || "- UNKNOWN: governance precheck failed without issue details",
    "",
    "After fixing the plan/constraints, run /start-work again.",
    "</system-reminder>",
  ].join("\n")
}

export async function runStartWorkPrecheckWithStatus(
  input: StartWorkPrecheckInput,
): Promise<StartWorkPrecheckResult> {
  const config = resolveGovernancePrecheckConfig(input.directory)
  if (!config.enabled || !config.baseUrl) {
    return { status: "skipped", failureBlock: null }
  }

  const precheckEndpoint = governanceEndpoint(config.baseUrl, "execute/precheck")
  const leaseAckEndpoint = governanceEndpoint(config.baseUrl, "lease/ack")

  const boulder = readBoulderState(input.directory)
  const planPath = boulder?.active_plan
  if (!planPath || !boulder) {
    return { status: "skipped", failureBlock: null }
  }

  const leaseTaskId = ensureLeaseTaskId(input.directory, boulder)

  const planContent = readFileSync(planPath, "utf8")
  const payload = {
    planContent,
    workspaceRoot: input.directory,
    role: "Atlas",
    requiredCapability: "project.verify",
    lease: {
      taskId: leaseTaskId,
      ownerSessionId: input.sessionID,
      ttlMs: 60_000,
    },
  }

  try {
    const response = await fetchWithTimeout(precheckEndpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }, config.timeoutMs)

    const data = (await response.json().catch(() => ({ ok: false, issues: [] }))) as PrecheckResponse
    if (!(response.ok && data.ok)) {
      return {
        status: "failed",
        failureBlock: buildFailureBlock(Array.isArray(data.issues) ? data.issues : []),
      }
    }

    if (data.decisionLogWritten === false) {
      return {
        status: "failed",
        failureBlock: buildFailureBlock([
          {
            code: "DECISION_LOG_WRITE_FAILED",
            message: "capability decision log write failed in Gaia precheck",
          },
        ]),
      }
    }

    const ackResponse = await fetchWithTimeout(leaseAckEndpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceRoot: input.directory,
        taskId: leaseTaskId,
        ownerSessionId: input.sessionID,
      }),
    }, config.timeoutMs)

    const ackData = (await ackResponse.json().catch(() => ({ ok: false, error: "invalid ack response" }))) as LeaseAckResponse
    if (!(ackResponse.ok && ackData.ok === true)) {
      return {
        status: "failed",
        failureBlock: buildFailureBlock([
          {
            code: "LEASE_ACK_FAILED",
            message: ackData.error ?? `lease ack failed with status ${ackResponse.status}`,
          },
        ]),
      }
    }

    if (data.decisionLogWritten === true) {
      const latestDecision = readLatestCapabilityDecision(input.directory)
      if (!latestDecision) {
        return {
          status: "failed",
          failureBlock: buildFailureBlock([
            {
              code: "DECISION_LOG_MISSING",
              message: "expected capability decision log entry after precheck success",
            },
          ]),
        }
      }

      const driftIssues = detectDecisionDrift(latestDecision, {
        role: "Atlas",
        requiredCapability: "project.verify",
        leaseTaskId,
        ownerSessionId: input.sessionID,
      })

      if (driftIssues.length > 0) {
        return {
          status: "failed",
          failureBlock: buildFailureBlock(driftIssues),
        }
      }
    }

    return {
      status: "passed",
      failureBlock: null,
      leaseTaskId,
    }
  } catch (error) {
    log("[start-work] governance precheck unavailable", {
      sessionID: input.sessionID,
      endpoint: precheckEndpoint,
      error: error instanceof Error ? error.message : String(error),
    })
    return { status: "skipped", failureBlock: null }
  }
}

export async function runStartWorkPrecheck(input: StartWorkPrecheckInput): Promise<string | null> {
  const result = await runStartWorkPrecheckWithStatus(input)
  return result.failureBlock
}
