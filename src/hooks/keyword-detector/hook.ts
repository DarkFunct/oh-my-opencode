import type { PluginInput } from "@opencode-ai/plugin"
import type { Message, Part } from "@opencode-ai/sdk"
import { detectKeywordsWithType, extractPromptText } from "./detector"
import { isPlannerAgent, isNonOmoAgent } from "./constants"
import { setModeMessage, getModeMessage, clearModeMessage } from "./mode-state"
import { log } from "../../shared"
import {
  isSystemDirective,
  removeSystemReminders,
} from "../../shared/system-directive"
import {
  getMainSessionID,
  getSessionAgent,
  subagentSessions,
} from "../../features/claude-code-session-state"
import type { ContextCollector } from "../../features/context-injector"

type MessageWithParts = {
  info: Message
  parts: Part[]
}

type MessagesTransformOutput = { messages: MessageWithParts[] }

export function createKeywordDetectorHook(ctx: PluginInput, _collector?: ContextCollector) {
  function getRuntimeVariant(input: { variant?: string }, message: Record<string, unknown>): string | undefined {
    if (typeof message["variant"] === "string") {
      return message["variant"]
    }

    return typeof input.variant === "string" ? input.variant : undefined
  }

  const chatMessage = async (
    input: {
      sessionID: string
      agent?: string
      model?: { providerID: string; modelID: string }
      messageID?: string
      variant?: string
    },
    output: {
      message: Record<string, unknown>
      parts: Array<{ type: string; text?: string; [key: string]: unknown }>
    }
  ): Promise<void> => {
    const promptText = extractPromptText(output.parts)

    if (isSystemDirective(promptText)) {
      log(`[keyword-detector] Skipping system directive message`, { sessionID: input.sessionID })
      return
    }

    const currentAgent = getSessionAgent(input.sessionID) ?? input.agent

    if (isNonOmoAgent(currentAgent)) {
      log(`[keyword-detector] Skipping keyword injection for non-OMO agent`, { sessionID: input.sessionID, agent: currentAgent })
      return
    }

    const cleanText = removeSystemReminders(promptText)
    const modelID = input.model?.modelID
    let detectedKeywords = detectKeywordsWithType(cleanText, currentAgent, modelID)

    if (isPlannerAgent(currentAgent)) {
      detectedKeywords = detectedKeywords.filter((k) => k.type !== "ultrawork")
    }

    if (detectedKeywords.length === 0) {
      return
    }

    const isBackgroundTaskSession = subagentSessions.has(input.sessionID)
    if (isBackgroundTaskSession) {
      return
    }

    const mainSessionID = getMainSessionID()
    const isNonMainSession = mainSessionID && input.sessionID !== mainSessionID

    if (isNonMainSession) {
      detectedKeywords = detectedKeywords.filter((k) => k.type === "ultrawork")
      if (detectedKeywords.length === 0) {
        log(`[keyword-detector] Skipping non-ultrawork keywords in non-main session`, {
          sessionID: input.sessionID,
          mainSessionID,
        })
        return
      }
    }

    const hasUltrawork = detectedKeywords.some((k) => k.type === "ultrawork")
    if (hasUltrawork) {
      const runtimeVariant = getRuntimeVariant(input, output.message)
      const isRuntimeMax = runtimeVariant === "max"

      log(`[keyword-detector] Ultrawork mode activated`, {
        sessionID: input.sessionID,
        runtimeVariant,
      })

      ctx.client.tui
        .showToast({
          body: {
            title: "Ultrawork Mode Activated",
            message: isRuntimeMax
              ? "Maximum precision engaged. All agents at your disposal."
              : "Runtime variant preserved. All agents at your disposal.",
            variant: "success" as const,
            duration: 3000,
          },
        })
        .catch((err) =>
          log(`[keyword-detector] Failed to show toast`, {
            error: err,
            sessionID: input.sessionID,
          })
        )
    }

    const allMessages = detectedKeywords.map((k) => k.message).join("\n\n")
    setModeMessage(input.sessionID, allMessages)

    log(`[keyword-detector] Detected ${detectedKeywords.length} keywords, stored in mode-state`, {
      sessionID: input.sessionID,
      types: detectedKeywords.map((k) => k.type),
    })
  }

  const messagesTransform = async (
    _input: Record<string, never>,
    output: MessagesTransformOutput,
  ): Promise<void> => {
    const lastUserMessage = findLastUserMessage(output.messages)
    if (!lastUserMessage) return

    const sessionID = extractSessionID(output.messages)
    if (!sessionID) return

    const modeMessage = getModeMessage(sessionID)
    if (!modeMessage) return

    const textPartIndex = lastUserMessage.parts.findIndex(
      (p) => p.type === "text" && (p as { text?: string }).text,
    )
    if (textPartIndex === -1) return

    const syntheticPart = {
      id: `keyword_mode_${sessionID}`,
      messageID: lastUserMessage.info.id,
      sessionID: (lastUserMessage.info as { sessionID?: string }).sessionID ?? "",
      type: "text" as const,
      text: modeMessage,
      synthetic: true,
    }

    lastUserMessage.parts.splice(textPartIndex, 0, syntheticPart as Part)

    clearModeMessage(sessionID)

    log("[keyword-detector] Injected mode message as synthetic part", { sessionID })
  }

  const event = async (input: { type: string; properties?: Record<string, unknown> }): Promise<void> => {
    if (input.type === "session.deleted") {
      const sessionID = input.properties?.["sessionID"]
      if (typeof sessionID === "string") {
        clearModeMessage(sessionID)
      }
    }
  }

  return {
    "chat.message": chatMessage,
    "experimental.chat.messages.transform": messagesTransform,
    event,
  }
}

function findLastUserMessage(messages: MessageWithParts[]): MessageWithParts | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].info.role === "user") {
      return messages[i]
    }
  }
  return undefined
}

function extractSessionID(messages: MessageWithParts[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const sid = (messages[i].info as { sessionID?: string }).sessionID
    if (sid) return sid
  }
  return undefined
}
