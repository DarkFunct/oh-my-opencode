import type { PluginInput } from "@opencode-ai/plugin"
import { createStartWorkHook as createLegacyStartWorkHook } from "./start-work-hook"
import { runStartWorkPrecheckWithStatus } from "./pre-execution-precheck"
import { buildGovernanceDecisionAlertBlock } from "./governance-alert-panel"
import {
  clearGovernanceSessionValidation,
  markGovernanceSessionValidated,
} from "../shared/governance-session-state"

interface StartWorkHookInput {
  sessionID: string
  messageID?: string
}

interface StartWorkHookOutput {
  parts: Array<{ type: string; text?: string }>
}

export const HOOK_NAME = "start-work" as const

function appendTextBlocks(output: StartWorkHookOutput, blocks: string[]): void {
  if (blocks.length === 0) return

  const index = output.parts.findIndex((part) => part.type === "text" && typeof part.text === "string")
  if (index >= 0 && output.parts[index].text) {
    output.parts[index].text += `\n\n${blocks.join("\n\n")}`
  }
}

export function createStartWorkHook(ctx: PluginInput) {
  const legacy = createLegacyStartWorkHook(ctx)

  return {
    "chat.message": async (input: StartWorkHookInput, output: StartWorkHookOutput): Promise<void> => {
      await legacy["chat.message"](input, output)

      clearGovernanceSessionValidation(input.sessionID)

      const precheck = await runStartWorkPrecheckWithStatus({
        directory: ctx.directory,
        sessionID: input.sessionID,
      })

      if (precheck.status === "passed") {
        markGovernanceSessionValidated(input.sessionID, precheck.leaseTaskId)
      }

      const blocks: string[] = []
      if (precheck.failureBlock) {
        blocks.push(precheck.failureBlock)
      }

      if (precheck.status === "passed") {
        const decisionAlertBlock = await buildGovernanceDecisionAlertBlock(ctx)
        if (decisionAlertBlock) {
          blocks.push(decisionAlertBlock)
        }
      }

      appendTextBlocks(output, blocks)
    },
  }
}
