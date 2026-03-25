import type { PluginInput } from "@opencode-ai/plugin"
import { getCognitiveState, deleteCognitiveSession } from "../cognitive-governance-shared/state"
import { classifySource } from "./source-classifier"
import { extractFilePath, extractStructuralSignals } from "./structural-signals"
import { matchTextSignals, isFixAttempt } from "./text-matcher"
import { fuseConfidence } from "./confidence-fusion"
import { detectResetTriggers } from "./reset-triggers"
import { executeResets } from "./reset-executor"
import { trackFileEdit, trackReadFile, trackBuildResult, trackTestResult } from "./edit-tracker"
import { isReadTool, isGrepTool, isExecuteTool, isCaptureTarget, detectMethodologyDimension } from "./evidence-signals"
import { scoreAllEvidences } from "../context-relevance-scorer"
import { log } from "../../shared"

const WRITE_TOOLS = new Set(["edit", "write", "ast_grep_replace", "lsp_rename"])

export function createSessionEvidenceCollectorHook(_ctx: PluginInput) {
	const toolExecuteBefore = async (
		input: { tool: string; sessionID: string; callID: string },
		output: { args: Record<string, unknown> },
	): Promise<void> => {
		try {
			const { tool, sessionID } = input
			const normalized = tool.toLowerCase()
			const state = getCognitiveState(sessionID)
			const filePath = extractFilePath(normalized, output.args)

			state.toolSequence.push({
				tool: normalized,
				timestamp: Date.now(),
				filePath,
			})

			if (isReadTool(normalized)) {
				if (filePath) {
					trackReadFile(state, filePath)
					state.newFilesReadSinceLastFailure++
				}
			}

			if (WRITE_TOOLS.has(normalized)) {
				state.editsSinceLastVerification++
			}

			if (isGrepTool(normalized)) {
				state.grepCount++
			}

			detectMethodologyDimension(state, normalized, filePath)
		} catch (e) {
			log("[gaia-hook-safe] sessionEvidenceCollector before failed", { error: e })
		}
	}

	const toolExecuteAfter = async (
		input: { tool: string; sessionID: string; callID: string },
		output: { title: string; output: string; metadata: Record<string, unknown> } | undefined,
	): Promise<void> => {
		try {
			if (!output) return
			const { tool, sessionID } = input
			const normalized = tool.toLowerCase()
			const state = getCognitiveState(sessionID)
			const safeOutput = output.output ?? ""

			state.roundCounter++

			const filePath = extractFilePath(normalized, output.metadata)

			if (filePath) {
				state.citationMap.set(filePath, (state.citationMap.get(filePath) ?? 0) + 1)
			}

			if (WRITE_TOOLS.has(normalized) && filePath) {
				trackFileEdit(state, filePath, normalized)
				state.executePhaseActive = true
				if (isCaptureTarget(filePath)) {
					state.captureCompleted = true
					state.captureSignals.push(filePath)
				}
			}

			if (isExecuteTool(normalized)) {
				trackBuildResult(state, safeOutput)
				trackTestResult(state, safeOutput)
				if (state.lastBuildResult === "success" || state.lastTestResult === "success") {
					state.editsSinceLastVerification = 0
				}
			}

			const source = classifySource(normalized)
			const signals = extractStructuralSignals(source, safeOutput, output.metadata)
			if (filePath) signals.filePath = filePath
			const textMatches = matchTextSignals(source, safeOutput, signals)
			const classification = fuseConfidence(signals, textMatches, source)

			if (classification.classification === "error" && classification.confidence >= 0.8) {
				state.detectedErrors.push({
					pattern: classification.evidence[0] ?? "unknown",
					rawMessage: textMatches[0]?.pattern ?? `exitCode=${signals.exitCode}`,
					tool: normalized,
					timestamp: Date.now(),
					round: state.roundCounter,
					filePath,
					source,
					confidence: classification.confidence,
				})
				state.consecutiveFixFailures++
				state.newFilesReadSinceLastFailure = 0
			} else if (classification.classification === "info" && classification.confidence >= 0.8) {
				if (state.consecutiveFixFailures > 0 && isExecuteTool(normalized)) {
					state.consecutiveFixFailures = 0
				}
			}

			const triggers = detectResetTriggers(state, classification)
			if (triggers.length > 0) {
				executeResets(state, triggers)
			}

			scoreAllEvidences(state)

			if (isFixAttempt(safeOutput)) {
				state.fixAttempts++
				if (filePath) state.lastFixTarget = filePath
			}
		} catch (e) {
			log("[gaia-hook-safe] sessionEvidenceCollector after failed", { error: e })
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
		"tool.execute.before": toolExecuteBefore,
		"tool.execute.after": toolExecuteAfter,
		event,
	}
}
