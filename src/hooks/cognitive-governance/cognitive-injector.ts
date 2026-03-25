import type { Part } from "@opencode-ai/sdk"
import { log } from "../../shared"

type MessageWithParts = {
	info: { id: string; role: string; sessionID?: string }
	parts: Part[]
}

const MAX_INJECTION_LENGTH = 500

export function injectCognitiveDirective(
	messages: MessageWithParts[],
	sessionID: string,
	directive: string,
): boolean {
	const lastUserMessage = findLastUserMessage(messages)
	if (!lastUserMessage) return false

	const textPartIndex = lastUserMessage.parts.findIndex(
		(p) => p.type === "text" && (p as { text?: string }).text,
	)
	if (textPartIndex === -1) return false

	const truncatedDirective = directive.length > MAX_INJECTION_LENGTH
		? directive.slice(0, MAX_INJECTION_LENGTH) + "\n..."
		: directive

	const syntheticPart = {
		id: `cognitive_governance_${sessionID}`,
		messageID: lastUserMessage.info.id,
		sessionID: (lastUserMessage.info as { sessionID?: string }).sessionID ?? "",
		type: "text" as const,
		text: truncatedDirective,
		synthetic: true,
	}

	lastUserMessage.parts.splice(textPartIndex, 0, syntheticPart as Part)

	log("[cognitive-governance] Injected directive", {
		sessionID,
		length: truncatedDirective.length,
	})

	return true
}

function findLastUserMessage(messages: MessageWithParts[]): MessageWithParts | undefined {
	for (let i = messages.length - 1; i >= 0; i--) {
		if (messages[i].info.role === "user") {
			return messages[i]
		}
	}
	return undefined
}
