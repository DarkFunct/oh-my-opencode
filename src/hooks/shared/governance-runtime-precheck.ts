import { randomUUID } from "node:crypto"
import {
  detectDecisionDrift,
  readLatestCapabilityDecision,
} from "../start-work/capability-decision-audit"
import {
  fetchWithTimeout,
  governanceEndpoint,
  resolveGovernancePrecheckConfig,
} from "./governance-precheck-config"
import {
  getGovernanceSessionLeaseTaskId,
  isGovernanceSessionValidated,
  markGovernanceSessionValidated,
} from "./governance-session-state"

type GovernanceRole =
  | "Prometheus"
  | "Metis"
  | "Momus"
  | "Atlas"
  | "Sisyphus-Junior"
  | "Oracle"
  | "Explore"
  | "Librarian"

type RuntimePrecheckStatus = "passed" | "failed" | "skipped"

export interface RuntimeGovernancePrecheckInput {
  directory: string
  sessionID: string
  agent?: string
  tool: string
  args: Record<string, unknown>
}

export interface RuntimeGovernancePrecheckResult {
  status: RuntimePrecheckStatus
  message: string | null
  leaseTaskId?: string
}

interface PrecheckIssue {
  code?: string
  message?: string
}

interface PrecheckResponse {
  ok?: boolean
  issues?: PrecheckIssue[]
  decisionLogWritten?: boolean
}

interface LeaseAckResponse {
  ok?: boolean
  error?: string
}

function normalizeAgent(agent: string | undefined): string {
  return (agent ?? "").trim().toLowerCase()
}

function resolveRole(agent: string | undefined): GovernanceRole {
  const normalized = normalizeAgent(agent)
  if (normalized.includes("atlas")) return "Atlas"
  if (normalized.includes("prometheus")) return "Prometheus"
  if (normalized.includes("metis")) return "Metis"
  if (normalized.includes("momus")) return "Momus"
  if (normalized.includes("oracle")) return "Oracle"
  if (normalized.includes("explore")) return "Explore"
  if (normalized.includes("librarian")) return "Librarian"
  return "Sisyphus-Junior"
}

function extractTargetPath(args: Record<string, unknown>): string {
  const candidate =
    args.filePath
    ?? args.file_path
    ?? args.path
    ?? args.file
  return typeof candidate === "string" && candidate.trim().length > 0 ? candidate.trim() : "AGENTS.md"
}

function syntheticPlanContent(input: RuntimeGovernancePrecheckInput, role: GovernanceRole, targetPath: string): string {
  const planId = `AUTO-${input.sessionID.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 48)}`
  const title = "Runtime Governance Auto Plan"
  const now = new Date().toISOString()

  return [
    "---",
    `plan_id: ${planId}`,
    `title: ${title}`,
    "status: approved",
    "created_by: Runtime-Governance-Gate",
    "---",
    "",
    "## Context",
    `Runtime precheck for session ${input.sessionID} and tool ${input.tool} at ${now}.`,
    "",
    "## Scope Boundaries",
    `Only authorize guarded runtime write for target ${targetPath}.`,
    "",
    "## Risks / Rollback",
    "If precheck fails, block execution and return to analysis stage.",
    "",
    "## Confirmed Requirements",
    "- CR-001: Runtime write must pass Gaia pre-execution governance gate.",
    "",
    "## Evidence Facts",
    "- EF-001: Session attempted execute-class tool and requires governance validation.",
    "",
    "## Unresolved Questions",
    "",
    "## Rejected Alternatives",
    "",
    "## Execution Tasks",
    `- E-001 | title: Guard runtime execute tool | owner_role: ${role} | file_scope: ${targetPath} | blocked_by:`,
    "",
    "## Verification Tasks",
    "- V-001 | title: Verify governance precheck and lease ack | command_or_check: precheck+ack response ok",
    "",
    "## Acceptance Criteria",
    "- AC-001: Execute tool is allowed only after governance precheck succeeds.",
    "",
    "## References",
    "none",
    "",
  ].join("\n")
}

function failureMessage(details: string): string {
  return [
    "[Governance Execution Gate] 执行操作被阻断",
    "",
    details,
    "请先补齐治理前置条件后重试。",
  ].join("\n")
}

export async function runRuntimeGovernancePrecheck(
  input: RuntimeGovernancePrecheckInput,
): Promise<RuntimeGovernancePrecheckResult> {
  const config = resolveGovernancePrecheckConfig(input.directory)
  if (!config.enabled || !config.baseUrl) {
    return { status: "skipped", message: null }
  }

  if (isGovernanceSessionValidated(input.sessionID)) {
    return {
      status: "passed",
      message: null,
      leaseTaskId: getGovernanceSessionLeaseTaskId(input.sessionID),
    }
  }

  const role = resolveRole(input.agent)
  const requiredCapability = "project.modify"
  const targetPath = extractTargetPath(input.args)
  const leaseTaskId = getGovernanceSessionLeaseTaskId(input.sessionID) ?? randomUUID()

  const payload = {
    planContent: syntheticPlanContent(input, role, targetPath),
    workspaceRoot: input.directory,
    role,
    requiredCapability,
    backgroundModel: {
      taskBoundary: `Runtime execute request for ${input.tool}`,
      targetFiles: [targetPath],
      relatedFiles: [targetPath],
      callerCalleeChain: [`session:${input.sessionID}`],
      mustNotChange: ["governance protocol contracts"],
      blastRadius: [targetPath],
      unknowns: [`agent:${input.agent ?? "unknown"}`],
    },
    skills: {
      mandatorySkills: ["gaia-runtime-governance"],
      injectedSkills: ["gaia-runtime-governance"],
    },
    alignment: {
      goal: "Enable runtime governance precheck for execute operations",
      inScope: ["governance precheck", "lease protocol handshake"],
      outOfScope: ["business logic changes"],
      acceptanceCriteriaIds: ["AC-001"],
      globalInvariants: ["task lease protocol", "pre-execution gate consistency"],
    },
    recovery: {
      agentIdentity: role,
      taskBoundary: `Runtime execute request for ${input.tool}`,
      planPosition: "execution:E-001",
      todoCompleted: [],
      todoPending: ["V-001"],
      analyzedFileStructure: [targetPath],
      mustNotChange: ["governance protocol contracts"],
      unknowns: [`agent:${input.agent ?? "unknown"}`],
      capturedAt: new Date().toISOString(),
    },
    lease: {
      taskId: leaseTaskId,
      ownerSessionId: input.sessionID,
      ttlMs: 60_000,
    },
  }

  try {
    const precheckResponse = await fetchWithTimeout(
      governanceEndpoint(config.baseUrl, "execute/precheck"),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
      config.timeoutMs,
    )

    const precheckData = (await precheckResponse.json().catch(() => ({ ok: false, issues: [] }))) as PrecheckResponse
    if (!(precheckResponse.ok && precheckData.ok === true)) {
      const issueText = (precheckData.issues ?? [])
        .map((issue) => `${issue.code ?? "UNKNOWN"}: ${issue.message ?? "unknown"}`)
        .join("; ")
      return {
        status: "failed",
        message: failureMessage(`Gaia precheck rejected runtime write: ${issueText || "no issue details"}`),
      }
    }

    if (precheckData.decisionLogWritten === false) {
      return {
        status: "failed",
        message: failureMessage("Gaia precheck accepted but decision log write failed."),
      }
    }

    const ackResponse = await fetchWithTimeout(
      governanceEndpoint(config.baseUrl, "lease/ack"),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceRoot: input.directory,
          taskId: leaseTaskId,
          ownerSessionId: input.sessionID,
        }),
      },
      config.timeoutMs,
    )

    const ackData = (await ackResponse.json().catch(() => ({ ok: false, error: "invalid ack response" }))) as LeaseAckResponse
    if (!(ackResponse.ok && ackData.ok === true)) {
      return {
        status: "failed",
        message: failureMessage(`Gaia lease ack failed: ${ackData.error ?? `status ${ackResponse.status}`}`),
      }
    }

    if (precheckData.decisionLogWritten === true) {
      const latestDecision = readLatestCapabilityDecision(input.directory)
      if (!latestDecision) {
        return {
          status: "failed",
          message: failureMessage("Gaia decision log missing after successful runtime precheck."),
        }
      }

      const driftIssues = detectDecisionDrift(latestDecision, {
        role,
        requiredCapability,
        leaseTaskId,
        ownerSessionId: input.sessionID,
      })
      if (driftIssues.length > 0) {
        return {
          status: "failed",
          message: failureMessage(`Decision drift detected: ${driftIssues.map((item) => item.code).join(", ")}`),
        }
      }
    }

    markGovernanceSessionValidated(input.sessionID, leaseTaskId)
    return {
      status: "passed",
      message: null,
      leaseTaskId,
    }
  } catch (error) {
    return {
      status: "failed",
      message: failureMessage(
        `Gaia precheck endpoint unavailable: ${error instanceof Error ? error.message : String(error)}`,
      ),
    }
  }
}
