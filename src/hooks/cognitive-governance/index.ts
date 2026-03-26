import type { PluginInput } from "@opencode-ai/plugin"
import type { Message, Part } from "@opencode-ai/sdk"
import type { CognitiveFailureId } from "../cognitive-governance-shared/types"
import { getCognitiveState, deleteCognitiveSession } from "../cognitive-governance-shared/state"
import { assessCognition, determineCognitiveLayer } from "./conversation-analyzer"
import { buildCognitiveDirective } from "./prompts"
import { injectCognitiveDirective } from "./cognitive-injector"
import { detectCognitiveFailureWarn } from "./failure-directives"
import { recordInjection, checkInjectionResolutions } from "./injection-tracker"
import { log } from "../../shared"

type MessageWithParts = {
	info: Message
	parts: Part[]
}

type MessagesTransformOutput = { messages: MessageWithParts[] }

export function createCognitiveGovernanceHook(_ctx: PluginInput) {
	const messagesTransform = async (
		_input: Record<string, never>,
		output: MessagesTransformOutput,
	): Promise<void> => {
		try {
			const sessionID = extractSessionID(output.messages)
			if (!sessionID) return

			const state = getCognitiveState(sessionID)

			state.currentLayer = determineCognitiveLayer(state)

			const assessment = assessCognition(state)

			if (assessment.captureNeeded) {
				state.roundsSinceCaptureNeeded++
			}

			const failureWarning = detectCognitiveFailureWarn(state)
			const directive = failureWarning ?? buildCognitiveDirective(assessment)

			if (!directive) return

			injectCognitiveDirective(output.messages, sessionID, directive)

			checkInjectionResolutions(state)
			recordInjection(state, failureWarning ? extractFailureId(failureWarning) : "cognitive_directive")
		} catch (e) {
			log("[gaia-hook-safe] cognitiveGovernance transform failed", { error: e })
		}
	}

	const event = async ({ event }: { event: { type: string; properties?: unknown } }): Promise<void> => {
		if (event.type !== "session.deleted") return
		const props = event.properties as { info?: { id?: string } } | undefined
		const sessionId = props?.info?.id
		if (sessionId) {
			deleteCognitiveSession(sessionId)
		}
	}

	return {
		"experimental.chat.messages.transform": messagesTransform,
		event,
	}
}

function extractSessionID(messages: MessageWithParts[]): string | undefined {
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i]
		const sid = (msg.info as { sessionID?: string }).sessionID
		if (sid) return sid
	}
	return undefined
}

const FAILURE_ID_PATTERN = /\[F([1-5])/

function extractFailureId(directive: string): CognitiveFailureId | "cognitive_directive" {
	const match = directive.match(FAILURE_ID_PATTERN)
	if (match) return `F${match[1]}` as CognitiveFailureId
	return "cognitive_directive"
}
