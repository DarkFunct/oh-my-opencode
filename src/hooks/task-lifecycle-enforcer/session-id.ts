import type { Message, Part } from "@opencode-ai/sdk"

type MessageWithParts = {
	info: Message
	parts: Part[]
}

export function extractSessionID(messages: MessageWithParts[]): string | undefined {
	for (let i = messages.length - 1; i >= 0; i--) {
		const sid = (messages[i].info as { sessionID?: string }).sessionID
		if (sid) return sid
	}
	return undefined
}
