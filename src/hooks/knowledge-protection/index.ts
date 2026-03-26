import type { PluginInput } from "@opencode-ai/plugin"
import type { Message, Part } from "@opencode-ai/sdk"
import { loadRules, clearRuleCache } from "./rule-loader"
import { matchRules } from "./rule-matcher"
import { trackBashResult, createProtectionState } from "./capture-detector"
import type { ProtectionState } from "./types"
import { log } from "../../shared"

type MessageWithParts = {
	info: Message
	parts: Part[]
}

type MessagesTransformOutput = { messages: MessageWithParts[] }

const protectionStates = new Map<string, ProtectionState>()

function getState(sessionID: string): ProtectionState {
	let state = protectionStates.get(sessionID)
	if (!state) {
		state = createProtectionState()
		protectionStates.set(sessionID, state)
	}
	return state
}

function formatWarning(results: ReturnType<typeof matchRules>): string {
	return results.map((r) => `[${r.rule.id}] ${r.rule.message}\n修复: ${r.rule.fix}`).join("\n\n")
}

const MAX_INJECTION_LENGTH = 400

export function createKnowledgeProtectionHook(ctx: PluginInput) {
	const toolExecuteBefore = async (
		input: { tool: string; sessionID: string; callID: string },
		output: { args: Record<string, unknown> },
	): Promise<void> => {
		const rules = loadRules(ctx.directory)
		if (rules.length === 0) return

		const tool = input.tool.toLowerCase()
		const results = matchRules(rules, tool, output.args)
		if (results.length === 0) return

		const hasBlocking = results.some((r) => r.rule.severity === "error")
		const warning = formatWarning(results)

		log("[knowledge-protection] Matched rules", {
			tool,
			sessionID: input.sessionID,
			ruleIds: results.map((r) => r.rule.id),
			blocking: hasBlocking,
		})

		if (hasBlocking) {
			throw new Error(`[knowledge-protection] 知识库匹配到已知陷阱:\n\n${warning}`)
		}
	}

	const toolExecuteAfter = async (
		input: { tool: string; sessionID: string; callID: string },
		output: { title: string; output: string; metadata: Record<string, unknown> } | undefined,
	): Promise<void> => {
		if (!output) return
		if (input.tool.toLowerCase() !== "bash") return

		const state = getState(input.sessionID)
		const command = typeof output.metadata.command === "string"
			? output.metadata.command
			: ""
		trackBashResult(state, command, output.output ?? "", output.metadata)
	}

	const messagesTransform = async (
		_input: Record<string, never>,
		output: MessagesTransformOutput,
	): Promise<void> => {
		const sessionID = extractSessionID(output.messages)
		if (!sessionID) return

		const state = protectionStates.get(sessionID)
		if (!state?.knowledgeCaptureNeeded) return

		const capturePrompt = buildCapturePrompt(state.captureContext)
		injectDirective(output.messages, sessionID, capturePrompt)

		state.knowledgeCaptureNeeded = false
		state.captureContext = null
	}

	const event = async ({ event }: { event: { type: string; properties?: unknown } }): Promise<void> => {
		if (event.type !== "session.deleted") return
		const props = event.properties as { info?: { id?: string } } | undefined
		const sessionId = props?.info?.id
		if (sessionId) {
			protectionStates.delete(sessionId)
		}
	}

	return {
		"tool.execute.before": toolExecuteBefore,
		"tool.execute.after": toolExecuteAfter,
		"experimental.chat.messages.transform": messagesTransform,
		event,
	}
}

function extractSessionID(messages: MessageWithParts[]): string | undefined {
	for (let i = messages.length - 1; i >= 0; i--) {
		const sid = (messages[i].info as { sessionID?: string }).sessionID
		if (sid) return sid
	}
	return undefined
}

function buildCapturePrompt(context: string | null): string {
	const base = [
		"\n<knowledge-capture-needed>",
		"检测到 trial-and-error 知识发现。请将新发现的 pitfall 同时写入:",
		"1. `_meta/knowledge/pitfalls.md` (人类可读)",
		"2. `_meta/knowledge/pitfall-rules.yaml` (机器可匹配规则)",
		"</knowledge-capture-needed>",
	]
	if (context) base.splice(2, 0, `上下文: ${context}`)
	return base.join("\n")
}

function injectDirective(
	messages: MessageWithParts[],
	sessionID: string,
	directive: string,
): boolean {
	const lastUser = messages.findLast((m) => m.info.role === "user")
	if (!lastUser) return false

	const textIdx = lastUser.parts.findIndex(
		(p) => p.type === "text" && (p as { text?: string }).text,
	)
	if (textIdx === -1) return false

	const truncated = directive.length > MAX_INJECTION_LENGTH
		? directive.slice(0, MAX_INJECTION_LENGTH) + "\n..."
		: directive

	lastUser.parts.splice(textIdx, 0, {
		id: `knowledge_protection_${sessionID}`,
		messageID: lastUser.info.id,
		sessionID: (lastUser.info as { sessionID?: string }).sessionID ?? "",
		type: "text",
		text: truncated,
		synthetic: true,
	} as Part)

	return true
}

export { clearRuleCache }
