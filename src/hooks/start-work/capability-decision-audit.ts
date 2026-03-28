import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

export interface CapabilityDecisionRecord {
  outcome?: string
  role?: string
  requiredCapability?: string
  leaseTaskId?: string
  ownerSessionId?: string
}

export interface CapabilityDecisionExpectation {
  role: string
  requiredCapability: string
  leaseTaskId: string
  ownerSessionId: string
}

export interface DecisionDriftIssue {
  code: string
  message: string
}

const DECISION_LOG_PATH = [".kgs", "governance", "capability-decisions.jsonl"]

export function readLatestCapabilityDecision(workspaceRoot: string): CapabilityDecisionRecord | null {
  const filePath = join(workspaceRoot, ...DECISION_LOG_PATH)
  if (!existsSync(filePath)) return null

  try {
    const lines = readFileSync(filePath, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
    const latest = lines[lines.length - 1]
    if (!latest) return null
    const parsed = JSON.parse(latest)
    return parsed && typeof parsed === "object"
      ? (parsed as CapabilityDecisionRecord)
      : null
  } catch {
    return null
  }
}

export function detectDecisionDrift(
  record: CapabilityDecisionRecord,
  expected: CapabilityDecisionExpectation,
): DecisionDriftIssue[] {
  const issues: DecisionDriftIssue[] = []

  if (record.outcome !== "ALLOWED") {
    issues.push({ code: "DECISION_OUTCOME_MISMATCH", message: `expected ALLOWED, got ${record.outcome ?? "unknown"}` })
  }
  if (record.role !== expected.role) {
    issues.push({ code: "DECISION_ROLE_MISMATCH", message: `expected ${expected.role}, got ${record.role ?? "unknown"}` })
  }
  if (record.requiredCapability !== expected.requiredCapability) {
    issues.push({
      code: "DECISION_CAPABILITY_MISMATCH",
      message: `expected ${expected.requiredCapability}, got ${record.requiredCapability ?? "unknown"}`,
    })
  }
  if (record.leaseTaskId !== expected.leaseTaskId) {
    issues.push({
      code: "DECISION_LEASE_TASK_MISMATCH",
      message: `expected ${expected.leaseTaskId}, got ${record.leaseTaskId ?? "unknown"}`,
    })
  }
  if (record.ownerSessionId !== expected.ownerSessionId) {
    issues.push({
      code: "DECISION_OWNER_SESSION_MISMATCH",
      message: `expected ${expected.ownerSessionId}, got ${record.ownerSessionId ?? "unknown"}`,
    })
  }

  return issues
}
