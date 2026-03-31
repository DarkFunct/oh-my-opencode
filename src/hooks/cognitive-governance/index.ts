import type { PluginInput } from "@opencode-ai/plugin"
import type { Message, Part } from "@opencode-ai/sdk"
import type { CognitiveGovernanceConfig } from "../../config"
import type { CognitiveFailureId, SessionCognitiveState } from "../cognitive-governance-shared/types"
import { getCognitiveState, deleteCognitiveSession } from "../cognitive-governance-shared/state"
import {
	setCognitiveReviewVerdict,
	clearCognitiveReviewVerdict,
	type CognitiveReviewVerdictInput,
} from "../cognitive-governance-shared/review-state"
import { assessCognition, determineCognitiveLayer } from "./conversation-analyzer"
import {
	evaluateGaiaStageAFromThinking,
	type GaiaStageAEvaluationOptions,
} from "./gaia-stage-a-adapter"
import { extractAssistantThinkingTrace, extractAssistantTextContent } from "./thinking-trace-extractor"
import { extractLatestStageBVerdict } from "./stage-b-verdict-parser"
import { buildStageBReviewRequest, shouldRequestStageBReview } from "./stage-b-review-request"
import { buildCognitiveDirective } from "./prompts"
import { collectDvDgCaBlocks, composeDirectiveWithBlocks } from "./directive-block-collector"
import { injectCognitiveDirective, type CognitiveDirectiveInjectionConfig } from "./cognitive-injector"
import { detectCognitiveFailureWarn } from "./failure-directives"
import { recordInjection, checkInjectionResolutions } from "./injection-tracker"
import { log } from "../../shared"

type MessageWithParts = {
	info: Message
	parts: Part[]
}

type MessagesTransformOutput = { messages: MessageWithParts[] }

export function createCognitiveGovernanceHook(
	_ctx: PluginInput,
	config?: CognitiveGovernanceConfig,
) {
	const directiveBudget = config?.directive_budget
	const injectionConfig: CognitiveDirectiveInjectionConfig = {
		mode: directiveBudget?.mode,
		appendOmissionNotice: directiveBudget?.append_omission_notice,
	}
	const maxInjectionLength = directiveBudget?.max_injection_length ?? 500
	const budgetEnabled = directiveBudget?.enabled ?? true
	const stageAOptions = resolveGaiaStageAOptions(config)

	const messagesTransform = async (
		_input: Record<string, never>,
		output: MessagesTransformOutput,
	): Promise<void> => {
		try {
			const sessionID = extractSessionID(output.messages)
			if (!sessionID) return

			const state = getCognitiveState(sessionID)
			let stageAVerdict: CognitiveReviewVerdictInput | null = null
			const thinkingTrace = extractAssistantThinkingTrace(output.messages)
			const evaluationContent = thinkingTrace
				?? extractAssistantTextContent(output.messages)
				?? ""

			if (evaluationContent || stageAOptions?.includePerceptionDefaults !== false) {
				const stageA = evaluateGaiaStageAFromThinking(evaluationContent, stageAOptions)
				if (stageA) {
					stageAVerdict = stageA.verdict
					for (const dimension of stageA.dimensionsCovered) {
						state.dimensionsCovered.add(dimension)
					}

					const evidenceSignal = evaluationContent.length > 600
						? `${evaluationContent.slice(0, 600)}...`
						: evaluationContent
					state.cognitiveEvidence = stageA.dimensionsCovered.map((dimension) => ({
						layer: stageA.layer,
						dimension,
						signal: evidenceSignal,
						timestamp: Date.now(),
					}))
				}
			}

			const stageBVerdict = extractLatestStageBVerdict(output.messages)
			if (stageBVerdict) {
				setCognitiveReviewVerdict(sessionID, stageBVerdict)
			} else if (stageAVerdict) {
				setCognitiveReviewVerdict(sessionID, stageAVerdict)
			}

			state.currentLayer = determineCognitiveLayer(state)

			const assessment = assessCognition(state)

			if (assessment.captureNeeded) {
				state.roundsSinceCaptureNeeded++
			}

			const failureWarning = detectCognitiveFailureWarn(state)
			const baseDirective = failureWarning ?? buildCognitiveDirective(assessment)

			const dvDgCaBlocks = collectDvDgCaBlocks(state, config)
			const enrichedDirective = composeDirectiveWithBlocks(baseDirective, dvDgCaBlocks)
			if (!enrichedDirective) return

			const shouldInjectStageBRequest = !stageBVerdict && shouldRequestStageBReview(stageAVerdict)
			const directive = shouldInjectStageBRequest && stageAVerdict
				? `${enrichedDirective}\n\n${buildStageBReviewRequest(stageAVerdict)}`
				: enrichedDirective

			if (!directive) return

			if (!budgetEnabled) {
				injectCognitiveDirective(output.messages, sessionID, directive)
			} else {
				injectCognitiveDirective(output.messages, sessionID, directive, maxInjectionLength, injectionConfig)
			}

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
			clearCognitiveReviewVerdict(sessionId)
		}
	}

	return {
		"experimental.chat.messages.transform": messagesTransform,
		event,
	}
}

function resolveGaiaStageAOptions(config?: CognitiveGovernanceConfig): GaiaStageAEvaluationOptions | undefined {
	const perceptionDefaults = config?.perception_defaults
	if (!perceptionDefaults) {
		return undefined
	}

	return {
		includePerceptionDefaults: perceptionDefaults.include_perception_defaults,
		maxCharsPerFile: perceptionDefaults.max_chars_per_file,
		workspaceRoot: perceptionDefaults.workspace_root,
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
