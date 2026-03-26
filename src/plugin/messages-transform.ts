import type { Message, Part } from "@opencode-ai/sdk"

import type { CreatedHooks } from "../create-hooks"
import { log } from "../shared"

type MessageWithParts = {
  info: Message
  parts: Part[]
}

type MessagesTransformOutput = { messages: MessageWithParts[] }

export function createMessagesTransformHandler(args: {
  hooks: CreatedHooks
}): (input: Record<string, never>, output: MessagesTransformOutput) => Promise<void> {
  return async (input, output): Promise<void> => {
    await args.hooks.contextInjectorMessagesTransform?.[
      "experimental.chat.messages.transform"
    ]?.(input, output)

    await args.hooks.thinkingBlockValidator?.[
      "experimental.chat.messages.transform"
    ]?.(input, output)

    await args.hooks.cognitiveGovernance?.[
      "experimental.chat.messages.transform"
    ]?.(input, output)

    await args.hooks.knowledgeProtection?.[
      "experimental.chat.messages.transform"
    ]?.(input, output)

    try {
      await args.hooks.keywordDetector?.[
        "experimental.chat.messages.transform"
      ]?.(input, output)
    } catch (e) {
      log("[gaia-hook-error] keywordDetector messagesTransform failed", { error: e })
    }

    try {
      await args.hooks.methodologyPhaseTracker?.[
        "experimental.chat.messages.transform"
      ]?.(input, output)
    } catch (e) {
      log("[gaia-hook-error] methodologyPhaseTracker messagesTransform failed", { error: e })
    }

    try {
      await args.hooks.taskLifecycleEnforcer?.[
        "experimental.chat.messages.transform"
      ]?.(input, output)
    } catch (e) {
      log("[gaia-hook-error] taskLifecycleEnforcer messagesTransform failed", { error: e })
    }
  }
}
