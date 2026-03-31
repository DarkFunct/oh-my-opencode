import type { PluginInput } from "@opencode-ai/plugin"
import { createKGSGuard, type RawCaptureInput } from "@gaia/omo-hooks"
import { getKGSService } from "../../features/kgs"
import { log } from "../../shared"
import {
	isWriteTool,
	recordWriteForCapture,
	cleanupSessionDebouncer,
	type WriteCaptureBatch,
} from "./write-capture-debouncer"
import {
	extractCaptureInput,
	extractFilePathFromArgs,
	type KGSGuardConfig,
} from "./capture-input-extractor"

const KGS_GUARD_LOG_PREFIX = "[kgs-guard]"
const EXEMPT_AGENTS = new Set(["explore", "librarian", "oracle", "metis", "momus"])
const MIN_OUTPUT_LENGTH = 100
const DEFAULT_WRITE_DEBOUNCE_MS = 10_000

function getAgentFromMetadata(metadata: Record<string, unknown> | undefined): string | undefined {
	if (!metadata) return undefined
	const agent = metadata.agent ?? metadata.agentName ?? metadata.agent_name
	return typeof agent === "string" ? agent.toLowerCase() : undefined
}

async function executeKGSCapture(captureInput: RawCaptureInput, sessionID: string): Promise<boolean> {
	try {
		const service = getKGSService()
		const guard = createKGSGuard({
			service,
			onWarning: (warning) => log(`${KGS_GUARD_LOG_PREFIX} ${warning}`),
		})

		const result = await guard.captureKnowledge(captureInput)
		log(`${KGS_GUARD_LOG_PREFIX} Capture complete`, {
			success: result.success,
			retriesUsed: result.retriesUsed,
			durationMs: result.durationMs,
			warningCount: result.warnings.length,
			sessionID,
		})
		return result.success
	} catch (error) {
		log(`${KGS_GUARD_LOG_PREFIX} Unexpected error`, { error })
		return false
	}
}

function handleWriteBatchFlush(batch: WriteCaptureBatch): void {
	const captureInput: RawCaptureInput = {
		changedFiles: batch.files.map(f => ({ path: f.filePath, changeType: f.changeType })),
		taskDescription: `Direct file edits in session ${batch.sessionID}`,
		readEvidence: [],
		planEvidence: [],
		executeEvidence: [],
		captureEvidence: [],
		designDecisions: [],
		pitfalls: [],
		patterns: [],
		constraints: [],
	}

	executeKGSCapture(captureInput, batch.sessionID).catch((error) => {
		log(`${KGS_GUARD_LOG_PREFIX} Write batch capture failed`, { error })
	})
}

export function createKGSGuardHook(_ctx: PluginInput, config?: KGSGuardConfig) {
	const debounceMs = config?.write_debounce_ms ?? DEFAULT_WRITE_DEBOUNCE_MS

	const toolExecuteBefore = async (
		input: { tool: string; sessionID: string; callID: string },
		output: { args: Record<string, unknown> },
	): Promise<void> => {
		if (!isWriteTool(input.tool)) return
		const filePath = extractFilePathFromArgs(output.args)
		recordWriteForCapture(input.sessionID, input.tool, filePath, debounceMs, handleWriteBatchFlush)
	}

	const toolExecuteAfter = async (
		input: { tool: string; sessionID: string; callID: string },
		output: { title: string; output: string; metadata: Record<string, unknown> },
	) => {
		if (input.tool !== "Task" && input.tool !== "task") return

		if (output.metadata?.sync === false || output.metadata?.run_in_background === true) {
			log(`${KGS_GUARD_LOG_PREFIX} Background launch, skipping`, { sessionID: input.sessionID })
			return
		}

		const responseText = output.output?.trim() ?? ""
		if (responseText.length < MIN_OUTPUT_LENGTH) return

		const agent = getAgentFromMetadata(output.metadata)
		if (agent && EXEMPT_AGENTS.has(agent)) {
			log(`${KGS_GUARD_LOG_PREFIX} Exempt agent, skipping`, { agent })
			return
		}

		const captureInput = extractCaptureInput(responseText, output.metadata)
		if (!captureInput) {
			log(`${KGS_GUARD_LOG_PREFIX} No capture input extracted, skipping`)
			return
		}

		const success = await executeKGSCapture(captureInput, input.sessionID)
		if (!success) {
			output.output = `${output.output ?? ""}\n\n[KGS Guard] Knowledge capture failed`
		}
	}

	const event = async ({ event }: { event: { type: string; properties?: unknown } }): Promise<void> => {
		if (event.type !== "session.deleted") return
		const props = event.properties as { info?: { id?: string } } | undefined
		const sessionId = props?.info?.id
		if (sessionId) cleanupSessionDebouncer(sessionId)
	}

	return {
		"tool.execute.before": toolExecuteBefore,
		"tool.execute.after": toolExecuteAfter,
		event,
	}
}
