import {
  fetchWithTimeout,
  governanceEndpoint,
  resolveGovernancePrecheckConfig,
} from "./governance-precheck-config"
import {
  getGovernanceBootGateState,
  markGovernanceBootGateState,
  type GovernanceBootGateState,
} from "./governance-session-state"

interface RuntimePolicySnapshot {
  version?: string
  fingerprint?: string
  providerCount?: number
}

interface RuntimePolicySnapshotResponse {
  ok?: boolean
  policy?: RuntimePolicySnapshot
}

export interface GovernanceBootGateInput {
  directory: string
  sessionID: string
}

function buildBootFailure(message: string): string {
  return [
    "[Governance Boot Gate] 启动阶段治理校验失败",
    "",
    message,
    "请先修复 Gaia runtime policy 配置后再执行写操作。",
  ].join("\n")
}

function isSnapshotValid(snapshot: RuntimePolicySnapshot | undefined): snapshot is RuntimePolicySnapshot {
  if (!snapshot) return false
  if (typeof snapshot.version !== "string" || snapshot.version.trim().length === 0) return false
  if (typeof snapshot.fingerprint !== "string" || snapshot.fingerprint.trim().length === 0) return false
  if (typeof snapshot.providerCount !== "number" || snapshot.providerCount <= 0) return false
  return true
}

export async function runGovernanceBootGate(
  input: GovernanceBootGateInput,
): Promise<GovernanceBootGateState> {
  const existingState = getGovernanceBootGateState(input.sessionID)
  if (existingState) return existingState

  const config = resolveGovernancePrecheckConfig(input.directory)
  if (!config.enabled || !config.baseUrl) {
    const skippedState: GovernanceBootGateState = {
      status: "skipped",
      checkedAt: Date.now(),
      message: "governance precheck disabled or endpoint missing",
    }
    markGovernanceBootGateState(input.sessionID, skippedState)
    return skippedState
  }

  try {
    const endpoint = governanceEndpoint(config.baseUrl, "runtime/policy/snapshot")
    const response = await fetchWithTimeout(endpoint, { method: "GET" }, config.timeoutMs)
    const data = (await response.json().catch(() => ({ ok: false }))) as RuntimePolicySnapshotResponse

    if (!(response.ok && data.ok === true && isSnapshotValid(data.policy))) {
      const failedState: GovernanceBootGateState = {
        status: "failed",
        checkedAt: Date.now(),
        message: buildBootFailure("Gaia runtime policy snapshot unavailable or invalid."),
      }
      markGovernanceBootGateState(input.sessionID, failedState)
      return failedState
    }

    if (config.runtimePolicyVersion && data.policy.version !== config.runtimePolicyVersion) {
      const failedState: GovernanceBootGateState = {
        status: "failed",
        checkedAt: Date.now(),
        policyVersion: data.policy.version,
        policyFingerprint: data.policy.fingerprint,
        message: buildBootFailure(
          `runtime policy version mismatch: expected ${config.runtimePolicyVersion}, got ${data.policy.version}`,
        ),
      }
      markGovernanceBootGateState(input.sessionID, failedState)
      return failedState
    }

    const passedState: GovernanceBootGateState = {
      status: "passed",
      checkedAt: Date.now(),
      policyVersion: data.policy.version,
      policyFingerprint: data.policy.fingerprint,
    }
    markGovernanceBootGateState(input.sessionID, passedState)
    return passedState
  } catch (error) {
    const failedState: GovernanceBootGateState = {
      status: "failed",
      checkedAt: Date.now(),
      message: buildBootFailure(
        `Gaia runtime policy snapshot request failed: ${error instanceof Error ? error.message : String(error)}`,
      ),
    }
    markGovernanceBootGateState(input.sessionID, failedState)
    return failedState
  }
}
