import { readBoulderState } from "../../features/boulder-state"
import { log } from "../../shared/logger"
import { resolveGovernanceWorkspaceRoot } from "../../hooks/shared/governance-workspace-root"
import {
  fetchWithTimeout,
  governanceEndpoint,
  resolveGovernancePrecheckConfig,
} from "../../hooks/shared/governance-precheck-config"

interface TodoSyncLeaseInput {
  ctx: { directory?: string } | undefined
  sessionID: string
  action: "ack" | "nack"
  reason?: string
}

export async function notifyTodoSyncLease(input: TodoSyncLeaseInput): Promise<void> {
  if (!input.ctx) return

  const directory = typeof input.ctx.directory === "string" ? input.ctx.directory : null
  if (!directory) return

  const config = resolveGovernancePrecheckConfig(directory)
  if (!config.enabled || !config.baseUrl) return
  const workspaceRoot = resolveGovernanceWorkspaceRoot(directory)

  const boulder = readBoulderState(directory)
  const leaseTaskId = boulder?.governance_lease_task_id
  if (!leaseTaskId) return

  const endpoint = input.action === "ack"
    ? governanceEndpoint(config.baseUrl, "lease/ack")
    : governanceEndpoint(config.baseUrl, "lease/nack")

  const body = input.action === "ack"
    ? {
      workspaceRoot,
      taskId: leaseTaskId,
      ownerSessionId: input.sessionID,
    }
    : {
      workspaceRoot,
      taskId: leaseTaskId,
      ownerSessionId: input.sessionID,
      reason: input.reason ?? "todo_sync_failed",
    }

  try {
    const response = await fetchWithTimeout(
      endpoint,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
      config.timeoutMs,
    )

    const data = (await response.json().catch(() => ({ ok: false, error: "invalid response" }))) as {
      ok?: boolean
      error?: string
    }

    if (!(response.ok && data.ok === true)) {
      log("[todo-sync] lease signal rejected", {
        sessionID: input.sessionID,
        action: input.action,
        leaseTaskId,
        status: response.status,
        error: data.error,
      })
    }
  } catch (error) {
    log("[todo-sync] lease signal failed", {
      sessionID: input.sessionID,
      action: input.action,
      leaseTaskId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
