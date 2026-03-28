import type { AutoRetryHelpers } from "./auto-retry"
import type { HookDeps, FallbackState } from "./types"
import { HOOK_NAME } from "./constants"
import { log } from "../../shared/logger"
import { prepareFallback } from "./fallback-state"
import type { GovernanceRuntimeFallbackReason } from "../shared/governance-runtime-fallback-types"
import { markGovernanceRuntimeFallbackState } from "../shared/governance-session-state"

type DispatchFallbackRetryOptions = {
  sessionID: string
  state: FallbackState
  fallbackModels: string[]
  resolvedAgent?: string
  source: string
  reason?: GovernanceRuntimeFallbackReason
  statusCode?: number
  errorName?: string
  errorMessage?: string
}

export async function dispatchFallbackRetry(
  deps: HookDeps,
  helpers: AutoRetryHelpers,
  options: DispatchFallbackRetryOptions,
): Promise<void> {
  const result = prepareFallback(
    options.sessionID,
    options.state,
    options.fallbackModels,
    deps.config,
  )

  if (result.success && deps.config.notify_on_fallback) {
    await deps.ctx.client.tui
      .showToast({
        body: {
          title: "Model Fallback",
          message: `Switching to ${result.newModel?.split("/").pop() || result.newModel} for next request`,
          variant: "warning",
          duration: 5000,
        },
      })
      .catch(() => {})
  }

  if (options.reason) {
    markGovernanceRuntimeFallbackState(options.sessionID, {
      reason: options.reason,
      source: options.source,
      updatedAt: Date.now(),
      selectedFallbackModel: result.success ? result.newModel : undefined,
      statusCode: options.statusCode,
      errorName: options.errorName,
      errorMessage: options.errorMessage,
    })
  }

  if (result.success && result.newModel) {
    await helpers.autoRetryWithFallback(
      options.sessionID,
      result.newModel,
      options.resolvedAgent,
      options.source,
    )
    return
  }

  log(`[${HOOK_NAME}] Fallback preparation failed`, {
    sessionID: options.sessionID,
    source: options.source,
    error: result.error,
  })
}
