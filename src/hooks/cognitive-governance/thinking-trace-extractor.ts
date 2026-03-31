import type { Message, Part } from "@opencode-ai/sdk"

type MessageWithParts = {
	info: Message
	parts: Part[]
}

function extractThinkingText(part: Part): string | null {
	const type = part.type as string
	if (type === "reasoning") {
		const text = (part as { text?: unknown }).text
		return typeof text === "string" ? text : null
	}

	if (type === "thinking") {
		const thinking = (part as { thinking?: unknown }).thinking
		if (typeof thinking === "string") return thinking
		const text = (part as { text?: unknown }).text
		return typeof text === "string" ? text : null
	}

	if (type === "redacted_thinking") {
		const text = (part as { text?: unknown }).text
		return typeof text === "string" ? text : null
	}

	return null
}

export function extractAssistantThinkingTrace(
	messages: MessageWithParts[],
	maxChars: number = 12000,
): string | null {
	const chunks: string[] = []

	for (const message of messages) {
		if (message.info.role !== "assistant") continue
		for (const part of message.parts ?? []) {
			const chunk = extractThinkingText(part)
			if (!chunk) continue
			const trimmed = chunk.trim()
			if (!trimmed) continue
			chunks.push(trimmed)
		}
	}

	const combined = chunks.join("\n").trim()
	if (!combined) return null
	if (combined.length <= maxChars) return combined
	return `${combined.slice(0, maxChars)}...`
}

function extractTextContent(part: Part): string | null {
	const type = part.type as string
	if (type !== "text") return null
	const text = (part as { text?: unknown }).text
	return typeof text === "string" ? text : null
}

export function extractAssistantTextContent(
	messages: MessageWithParts[],
	maxChars: number = 8000,
): string | null {
	const chunks: string[] = []

	for (const message of messages) {
		if (message.info.role !== "assistant") continue
		for (const part of message.parts ?? []) {
			const chunk = extractTextContent(part)
			if (!chunk) continue
			const trimmed = chunk.trim()
			if (!trimmed) continue
			chunks.push(trimmed)
		}
	}

	const combined = chunks.join("\n").trim()
	if (!combined) return null
	if (combined.length <= maxChars) return combined
	return `${combined.slice(0, maxChars)}...`
}
