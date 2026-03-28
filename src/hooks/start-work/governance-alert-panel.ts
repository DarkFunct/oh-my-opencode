import type { PluginInput } from "@opencode-ai/plugin"
import { createGovernanceDecisionAlertsClient } from "@gaia/omo-hooks"
import { log } from "../../shared/logger"
import { resolveGovernancePrecheckConfig } from "../shared/governance-precheck-config"

const ALERT_LIMIT = 5
const ALERT_TIMEOUT_MS = 1_200

function buildDecisionAlertBlock(summary: string): string {
  return [
    "<system-reminder>",
    "## Governance Decision Alerts",
    "",
    summary,
    "",
    "Review these governance alerts before continuing execution.",
    "</system-reminder>",
  ].join("\n")
}

function hasActionableAlerts(parseErrors: number, alertCount: number): boolean {
  return parseErrors > 0 || alertCount > 0
}

export async function buildGovernanceDecisionAlertBlock(ctx: PluginInput): Promise<string | null> {
  const config = resolveGovernancePrecheckConfig(ctx.directory)
  if (!config.enabled || !config.baseUrl) {
    return null
  }

  try {
    const client = createGovernanceDecisionAlertsClient({
      apiBaseUrl: config.baseUrl,
      timeoutMs: Math.min(config.timeoutMs, ALERT_TIMEOUT_MS),
    })

    const result = await client.execute({
      workspaceRoot: ctx.directory,
      limit: ALERT_LIMIT,
      includeAllowed: false,
    })

    if (!result.success || !result.data) {
      log("[start-work] governance decision alerts unavailable", {
        directory: ctx.directory,
        error: result.error ?? "unknown_error",
      })
      return null
    }

    if (!hasActionableAlerts(result.data.parseErrors, result.data.alerts.length)) {
      return null
    }

    return buildDecisionAlertBlock(result.summary)
  } catch (error) {
    log("[start-work] governance decision alerts failed-open", {
      directory: ctx.directory,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}
