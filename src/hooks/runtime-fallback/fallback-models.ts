import type { OhMyOpenCodeConfig } from "../../config"
import type { GovernanceRuntimeFallbackReason } from "../shared/governance-runtime-fallback-types"
import { agentPattern } from "./agent-resolver"
import { HOOK_NAME } from "./constants"
import { log } from "../../shared/logger"
import { SessionCategoryRegistry } from "../../shared/session-category-registry"
import { normalizeFallbackModels } from "../../shared/model-resolver"

function getReasonLadderFromRuntimeConfig(
  pluginConfig: OhMyOpenCodeConfig | undefined,
  reason: GovernanceRuntimeFallbackReason | undefined,
): string[] {
  if (!pluginConfig || !reason) return []
  const runtimeConfig = pluginConfig.runtime_fallback
  if (!runtimeConfig || typeof runtimeConfig !== "object") return []
  const ladders = runtimeConfig.ladders
  if (!ladders) return []
  const ladder = ladders[reason]
  if (!Array.isArray(ladder) || ladder.length === 0) return []
  return normalizeFallbackModels(ladder) ?? []
}

export function getFallbackModelsForSession(
  sessionID: string,
  agent: string | undefined,
  pluginConfig: OhMyOpenCodeConfig | undefined,
  reason?: GovernanceRuntimeFallbackReason,
): string[] {
  if (!pluginConfig) return []

  const reasonLadder = getReasonLadderFromRuntimeConfig(pluginConfig, reason)
  if (reasonLadder.length > 0) {
    log(`[${HOOK_NAME}] Using reason-specific fallback ladder`, {
      sessionID,
      reason,
      ladderSize: reasonLadder.length,
    })
    return reasonLadder
  }

  const sessionCategory = SessionCategoryRegistry.get(sessionID)
  if (sessionCategory && pluginConfig.categories?.[sessionCategory]) {
    const categoryConfig = pluginConfig.categories[sessionCategory]
    if (categoryConfig?.fallback_models) {
      return normalizeFallbackModels(categoryConfig.fallback_models) ?? []
    }
  }

  const tryGetFallbackFromAgent = (agentName: string): string[] | undefined => {
    const agentConfig = pluginConfig.agents?.[agentName as keyof typeof pluginConfig.agents]
    if (!agentConfig) return undefined
    
    if (agentConfig?.fallback_models) {
      return normalizeFallbackModels(agentConfig.fallback_models)
    }
    
    const agentCategory = agentConfig?.category
    if (agentCategory && pluginConfig.categories?.[agentCategory]) {
      const categoryConfig = pluginConfig.categories[agentCategory]
      if (categoryConfig?.fallback_models) {
        return normalizeFallbackModels(categoryConfig.fallback_models)
      }
    }
    
    return undefined
  }

  if (agent) {
    const result = tryGetFallbackFromAgent(agent)
    if (result) return result
  }

  const sessionAgentMatch = sessionID.match(agentPattern)
  if (sessionAgentMatch) {
    const detectedAgent = sessionAgentMatch[1].toLowerCase()
    const result = tryGetFallbackFromAgent(detectedAgent)
    if (result) return result
  }

  log(`[${HOOK_NAME}] No category/agent fallback models resolved for session`, { sessionID, agent })

  return []
}
