import type { PluginInput } from "@opencode-ai/plugin"
import { createGateResponse, escalate, writeGateMetadata, appendGateEvent, DEFAULT_GATE_RESPONSE_CONFIG } from "@gaia/omo-hooks"
import type { GateResponseConfig } from "@gaia/omo-hooks"
import { getCognitiveState, deleteCognitiveSession } from "../cognitive-governance-shared/state"
import { extractFilePath } from "../session-evidence-collector/structural-signals"
import { isExecuteTool } from "../session-evidence-collector/evidence-signals"
import { detectRepeatFix, incrementConsecutiveFailure } from "./repeat-fix-detector"
import { detectCaptureViolation } from "./capture-gate"
import { detectCognitiveFailureBlock } from "./failure-gate"
import { buildBlockMessage, buildCaptureBlockMessage } from "./prompts"
import { log } from "../../shared"
import type { FixLifecycleGateConfig } from "./config"
import { DEFAULT_FIX_LIFECYCLE_GATE_CONFIG } from "./config"
import { getGateMetadataDir } from "../gate-metadata-path"
import { shouldAbortSession, executeSessionAbort } from "./abort-handler"

export interface FixLifecycleGateOptions {
	configOverrides?: Partial<FixLifecycleGateConfig>
	gateResponseConfig?: Partial<GateResponseConfig>
}

export function createFixLifecycleGateHook(
	_ctx: PluginInput,
	options?: FixLifecycleGateOptions | Partial<FixLifecycleGateConfig>,
) {
	const opts = isLegacyConfig(options) ? { configOverrides: options } : (options ?? {})
	const config: FixLifecycleGateConfig = {
		...DEFAULT_FIX_LIFECYCLE_GATE_CONFIG,
		...opts.configOverrides,
	}
	const grConfig: GateResponseConfig = {
		...DEFAULT_GATE_RESPONSE_CONFIG,
		...opts.gateResponseConfig,
	}

	const blockCountMap = new Map<string, number>()

	function getBlockCount(sessionID: string, gateId: string): number {
		const key = `${sessionID}:${gateId}`
		const count = (blockCountMap.get(key) ?? 0) + 1
		blockCountMap.set(key, count)
		return count
	}

	async function writeGateBlock(sessionID: string, gateId: string, reason: string, recoveryAction: string): Promise<void> {
		try {
			const blockCount = getBlockCount(sessionID, gateId)
			const severity = escalate(blockCount, grConfig)
			const response = createGateResponse({ gateId, severity, reason, recoveryAction, blockCount })
			const dir = getGateMetadataDir(sessionID)
			await writeGateMetadata(dir, { gateResponse: response, timestamp: new Date().toISOString(), sessionId: sessionID, totalBlockCount: blockCount })
			await appendGateEvent(dir, { sessionId: sessionID, gateId, severity, blockCount, timestamp: new Date().toISOString() })
			if (shouldAbortSession(severity)) {
				log("[fix-lifecycle-gate] Abort threshold reached — terminating session", { sessionID, gateId, blockCount })
				await executeSessionAbort(_ctx, sessionID)
			}
		} catch (err) {
			log("[fix-lifecycle-gate] Failed to write gate metadata", { sessionID, gateId, error: err })
		}
	}

	const toolExecuteBefore = async (
		input: { tool: string; sessionID: string; callID: string },
		output: { args: Record<string, unknown> },
	): Promise<void> => {
		const { tool, sessionID } = input
		const normalized = tool.toLowerCase()

		if (!isExecuteTool(normalized)) return

		try {
			const state = getCognitiveState(sessionID)
			const filePath = extractFilePath(normalized, output.args)

			const cognitiveFailure = detectCognitiveFailureBlock(state, config)
			if (cognitiveFailure) {
				log("[fix-lifecycle-gate] Cognitive failure block", {
					sessionID, tool, failureId: cognitiveFailure.id, name: cognitiveFailure.name,
				})
				await writeGateBlock(sessionID, `fix-lifecycle-gate:${cognitiveFailure.id}`, cognitiveFailure.name, cognitiveFailure.directive)
				throw new Error(cognitiveFailure.directive)
			}

			if (filePath && state.lastFixTarget === filePath) {
				incrementConsecutiveFailure(state)
			}

			const verdict = detectRepeatFix(state, config)

			if (verdict.shouldBlock) {
				log("[fix-lifecycle-gate] Blocking repeat fix", {
					sessionID, tool, reason: verdict.reason, fixCount: verdict.fixCount, target: verdict.target,
				})
				const msg = buildBlockMessage(verdict)
				await writeGateBlock(sessionID, `fix-lifecycle-gate:repeat-fix:${verdict.reason}`, verdict.reason, msg)
				throw new Error(msg)
			}

			const captureVerdict = detectCaptureViolation(state, config)
			if (captureVerdict.shouldBlock) {
				log("[fix-lifecycle-gate] Blocking — capture overdue", {
					sessionID, tool, roundsPending: captureVerdict.roundsPending, editedFiles: captureVerdict.editedFiles,
				})
				const msg = buildCaptureBlockMessage(captureVerdict)
				await writeGateBlock(sessionID, "fix-lifecycle-gate:capture-overdue", "capture_overdue", msg)
				throw new Error(msg)
			}
		} catch (e) {
			if (e instanceof Error && e.message.startsWith("[🛑")) {
				throw e
			}
			log("[gaia-hook-safe] fixLifecycleGate before failed", { error: e })
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
		event,
	}
}

function isLegacyConfig(
	opts: FixLifecycleGateOptions | Partial<FixLifecycleGateConfig> | undefined,
): opts is Partial<FixLifecycleGateConfig> {
	if (!opts) return false
	return "repeatFixThreshold" in opts || "sameFileFixThreshold" in opts || "captureHardBlockThreshold" in opts
}
