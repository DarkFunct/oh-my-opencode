import { readBoulderState } from "../../features/boulder-state"
import { log } from "../../shared"
import { getGovernanceSessionLeaseTaskId } from "../shared/governance-session-state"
import { resolveGovernanceWorkspaceRoot } from "../shared/governance-workspace-root"
import {
  fetchWithTimeout,
  governanceEndpoint,
  resolveGovernancePrecheckConfig,
} from "../shared/governance-precheck-config"

interface LeaseSyncInput {
  directory: string
  sessionID: string
  action: "heartbeat" | "complete" | "nack"
  taskId?: string
  reason?: string
}

async function postLeaseSignal(
  endpoint: string,
  payload: Record<string, unknown>,
  timeoutMs: number,
): Promise<{ ok: boolean; status: number; error?: string }> {
  const response = await fetchWithTimeout(
    endpoint,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
    timeoutMs,
  )

  const data = (await response.json().catch(() => ({ ok: false, error: "invalid response" }))) as {
    ok?: boolean
    error?: string
  }

  return {
    ok: response.ok && data.ok === true,
    status: response.status,
    error: data.error,
  }
}

export async function syncTaskLeaseSignal(input: LeaseSyncInput): Promise<void> {
  const config = resolveGovernancePrecheckConfig(input.directory)
  if (!config.enabled || !config.baseUrl) return
  const workspaceRoot = resolveGovernanceWorkspaceRoot(input.directory)

  const boulder = readBoulderState(input.directory)
  const leaseTaskId = boulder?.governance_lease_task_id ?? getGovernanceSessionLeaseTaskId(input.sessionID)
  if (!leaseTaskId) return

  try {
    if (input.action === "heartbeat") {
      const result = await postLeaseSignal(
        governanceEndpoint(config.baseUrl, "lease/heartbeat"),
        {
          workspaceRoot,
          taskId: leaseTaskId,
          ownerSessionId: input.sessionID,
          ttlMs: 60_000,
        },
        config.timeoutMs,
      )
      if (!result.ok) {
        log("[task-lifecycle-enforcer] lease heartbeat failed", {
          sessionID: input.sessionID,
          leaseTaskId,
          taskId: input.taskId,
          status: result.status,
          error: result.error,
        })
      }
      return
    }

    if (input.action === "complete") {
      const result = await postLeaseSignal(
        governanceEndpoint(config.baseUrl, "lease/complete"),
        {
          workspaceRoot,
          taskId: leaseTaskId,
          ownerSessionId: input.sessionID,
          completionReceipt: `task_update:${input.taskId ?? "unknown"}:${new Date().toISOString()}`,
        },
        config.timeoutMs,
      )
      if (!result.ok) {
        log("[task-lifecycle-enforcer] lease complete failed", {
          sessionID: input.sessionID,
          leaseTaskId,
          taskId: input.taskId,
          status: result.status,
          error: result.error,
        })
      }
      return
    }

    const result = await postLeaseSignal(
      governanceEndpoint(config.baseUrl, "lease/nack"),
      {
        workspaceRoot,
        taskId: leaseTaskId,
        ownerSessionId: input.sessionID,
        reason: input.reason ?? "task_update_failed",
      },
      config.timeoutMs,
    )
    if (!result.ok) {
      log("[task-lifecycle-enforcer] lease nack failed", {
        sessionID: input.sessionID,
        leaseTaskId,
        taskId: input.taskId,
        status: result.status,
        error: result.error,
      })
    }
  } catch (error) {
    log("[task-lifecycle-enforcer] lease signal error", {
      sessionID: input.sessionID,
      action: input.action,
      leaseTaskId,
      taskId: input.taskId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
