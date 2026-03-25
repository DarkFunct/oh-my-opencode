import type { PluginInput } from "@opencode-ai/plugin"
import { getCognitiveState, deleteCognitiveSession } from "../cognitive-governance-shared/state"
import { detectErrors, isFixAttempt, extractFilePath } from "./error-detector"
import { trackFileEdit, trackReadFile, trackBuildResult, trackTestResult } from "./edit-tracker"
import { isReadTool, isGrepTool, isExecuteTool, isCaptureTarget, detectMethodologyDimension } from "./evidence-signals"
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
				if (filePath) trackReadFile(state, filePath)
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

			const filePath = extractFilePath(normalized, output.metadata)

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
			}

			const errors = detectErrors(safeOutput, normalized, filePath)
			if (errors.length > 0) {
				state.detectedErrors.push(...errors)
			}

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
