import type { Part } from "@opencode-ai/sdk"
import { log } from "../../shared"

type MessageWithParts = {
	info: { id: string; role: string; sessionID?: string }
	parts: Part[]
}

export type DirectiveBudgetMode = "priority_prune" | "legacy_truncate"

export interface CognitiveDirectiveInjectionConfig {
	mode?: DirectiveBudgetMode
	appendOmissionNotice?: boolean
}

interface PrioritizedBlock {
	text: string
	priority: number
	originalIndex: number
}

function blockPriority(block: string): number {
	if (/🚨|严重逾期|即将被拦截/i.test(block)) return 100
	if (/\[Stage B 认知复核请求\]/i.test(block)) return 95
	if (/未解决错误|修复尝试/i.test(block)) return 90
	if (/验证提醒|改而不验/i.test(block)) return 85
	if (/方法论覆盖不足/i.test(block)) return 80
	if (/Capture 阶段逾期/i.test(block)) return 75
	if (/Capture 提醒/i.test(block)) return 70
	return 50
}

function truncateWithEllipsis(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text
	if (maxLength <= 4) return text.slice(0, maxLength)
	return `${text.slice(0, maxLength - 4)}\n...`
}

export function composeDirectiveWithinBudget(
	directive: string,
	maxLength: number,
	appendOmissionNotice: boolean = true,
): string {
	const normalized = directive.replace(/\r\n/g, "\n").trim()
	if (!normalized) return normalized

	const blocks = normalized
		.split(/\n{2,}/)
		.map((block) => block.trim())
		.filter((block) => block.length > 0)

	if (blocks.length === 0) return ""
	if (blocks.length === 1) return truncateWithEllipsis(blocks[0], maxLength)

	const header = blocks[0]
	const bodyBlocks = blocks.slice(1)
	const rankedBlocks: PrioritizedBlock[] = bodyBlocks
		.map((text, index) => ({
			text,
			priority: blockPriority(text),
			originalIndex: index,
		}))
		.sort((a, b) => b.priority - a.priority || a.originalIndex - b.originalIndex)

	const selected: string[] = []
	let currentLength = header.length

	for (const block of rankedBlocks) {
		const nextLength = currentLength + 2 + block.text.length
		if (nextLength > maxLength) continue
		selected.push(block.text)
		currentLength = nextLength
	}

	const assembled = selected.length > 0
		? `${header}\n\n${selected.join("\n\n")}`
		: header

	if (assembled.length <= maxLength) {
		const omittedCount = bodyBlocks.length - selected.length
		if (omittedCount <= 0) return assembled
		if (!appendOmissionNotice) return assembled
		const notice = "\n\n..."
		if (assembled.length + notice.length <= maxLength) {
			return assembled + notice
		}
		return assembled
	}

	return truncateWithEllipsis(assembled, maxLength)
}

function composeDirectiveByMode(
	directive: string,
	maxLength: number,
	config: CognitiveDirectiveInjectionConfig,
): string {
	const mode = config.mode ?? "priority_prune"
	if (mode === "legacy_truncate") {
		const normalized = directive.replace(/\r\n/g, "\n").trim()
		return truncateWithEllipsis(normalized, maxLength)
	}

	return composeDirectiveWithinBudget(directive, maxLength, config.appendOmissionNotice ?? true)
}

export function injectCognitiveDirective(
	messages: MessageWithParts[],
	sessionID: string,
	directive: string,
	maxInjectionLength?: number,
	config: CognitiveDirectiveInjectionConfig = {},
): boolean {
	const lastUserMessage = findLastUserMessage(messages)
	if (!lastUserMessage) return false

	const textPartIndex = lastUserMessage.parts.findIndex(
		(p) => p.type === "text" && (p as { text?: string }).text,
	)
	if (textPartIndex === -1) return false

	const budgetedDirective = typeof maxInjectionLength === "number" && maxInjectionLength > 0
		? composeDirectiveByMode(directive, maxInjectionLength, config)
		: directive.replace(/\r\n/g, "\n").trim()

	const syntheticPart = {
		id: `cognitive_governance_${sessionID}`,
		messageID: lastUserMessage.info.id,
		sessionID: (lastUserMessage.info as { sessionID?: string }).sessionID ?? "",
		type: "text" as const,
		text: budgetedDirective,
		synthetic: true,
	}

	lastUserMessage.parts.splice(textPartIndex, 0, syntheticPart as Part)

	log("[cognitive-governance] Injected directive", {
		sessionID,
		length: budgetedDirective.length,
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
