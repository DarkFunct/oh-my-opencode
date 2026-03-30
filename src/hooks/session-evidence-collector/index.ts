import type { PluginInput } from "@opencode-ai/plugin"
import { getCognitiveState, deleteCognitiveSession } from "../cognitive-governance-shared/state"
import { recordCaptureWrite } from "../cognitive-governance-shared/capture-cooldown"
import { classifySource } from "./source-classifier"
import { extractFilePath, extractStructuralSignals } from "./structural-signals"
import { matchTextSignals, isFixAttempt } from "./text-matcher"
import { fuseConfidence } from "./confidence-fusion"
import { detectResetTriggers } from "./reset-triggers"
import { executeResets } from "./reset-executor"
import { trackFileEdit, trackReadFile, trackBuildResult, trackTestResult } from "./edit-tracker"
import { trackDeliveryEvidence, trackDocumentationEvidence } from "./delivery-doc-tracker"
import {
	evaluateCaptureDocumentationMaintenance,
	type DocumentationAutoManagementConfig,
} from "./capture-doc-maintenance"
import { isReadTool, isGrepTool, isExecuteTool, isCaptureTarget, detectMethodologyDimension, isVerifiableFile } from "./evidence-signals"
import { scanForSecrets } from "./secret-scanner"
import type { SecretScanConfig } from "./secret-scanner"
import { scoreAllEvidences } from "../context-relevance-scorer"
import { log } from "../../shared"

const WRITE_TOOLS = new Set(["edit", "write", "ast_grep_replace", "lsp_rename", "apply_patch"])

export interface SessionEvidenceCollectorOptions {
	docMaintenanceConfig?: Partial<DocumentationAutoManagementConfig>
	secretScanConfig?: SecretScanConfig
}

export function createSessionEvidenceCollectorHook(
	ctx: PluginInput,
	options?: SessionEvidenceCollectorOptions | Partial<DocumentationAutoManagementConfig>,
) {
	const isLegacy = !!options && ("staleness_threshold_hours" in options || "min_edit_distance" in options)
	const opts: SessionEvidenceCollectorOptions = isLegacy
		? { docMaintenanceConfig: options as Partial<DocumentationAutoManagementConfig> }
		: (options as SessionEvidenceCollectorOptions) ?? {}
	const projectRoot = typeof ctx.directory === "string" ? ctx.directory : process.cwd()

	const toolExecuteBefore = async (
		input: { tool: string; sessionID: string; callID: string },
		output: { args: Record<string, unknown> },
	): Promise<void> => {
		try {
			const { tool, sessionID } = input
			const normalized = tool.toLowerCase()
			const state = getCognitiveState(sessionID)
			const filePath = extractFilePath(normalized, output.args)
			const commandText =
				typeof output.args.command === "string"
					? output.args.command
					: typeof output.args.patchText === "string"
						? output.args.patchText
						: undefined

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
				if (filePath && isVerifiableFile(filePath)) {
					state.editsSinceLastVerification++
				}
				const wc = (typeof output.args.newString === "string" && output.args.newString)
					|| (typeof output.args.content === "string" && output.args.content)
					|| (typeof output.args.rewrite === "string" && output.args.rewrite)
					|| (typeof output.args.patchText === "string" && output.args.patchText)
					|| undefined
				if (wc && filePath) {
					state.lastSecretScanResult = scanForSecrets(wc, filePath, opts.secretScanConfig)
				}
			}

			if (isGrepTool(normalized)) {
				state.grepCount++
			}

			detectMethodologyDimension(state, normalized, filePath, commandText)
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

			if (WRITE_TOOLS.has(normalized)) {
				const effectiveFilePath = filePath ?? (normalized === "apply_patch" ? "__apply_patch__" : undefined)
				if (effectiveFilePath) {
					trackFileEdit(state, effectiveFilePath, normalized)
					if (isCaptureTarget(effectiveFilePath)) {
						recordCaptureWrite(state, effectiveFilePath)
						if (effectiveFilePath !== "__apply_patch__" && effectiveFilePath !== "_meta/knowledge/unknown") {
							evaluateCaptureDocumentationMaintenance({
								projectRoot,
								captureFilePath: effectiveFilePath,
								editedFiles: state.fileEditHistory.keys(),
								config: opts.docMaintenanceConfig,
							})
								.then((notice) => {
									if (notice && output) {
										output.output = (output.output ?? "") + "\n\n" + notice
									}
								})
								.catch((err) => {
									log("[gaia-hook-safe] capture-doc-maintenance failed", { error: err })
								})
						}
					}
				}
				if (!filePath && normalized === "apply_patch") {
					const hasCaptureSignal = /_meta\/knowledge\/|lessons-learned|pitfalls|constraints|decisions|\.sisyphus\/checkpoints\//i.test(safeOutput)
					if (hasCaptureSignal) {
						recordCaptureWrite(state, "_meta/knowledge/unknown")
					}
				}
				state.executePhaseActive = true
			}

			if (isExecuteTool(normalized)) {
				const buildSignal = trackBuildResult(state, safeOutput)
				const testSignal = trackTestResult(state, safeOutput)
				if (buildSignal === "success" || testSignal === "success") {
					state.editsSinceLastVerification = 0
				}
			}

			if (normalized === "lsp_diagnostics" && hasCleanDiagnostics(safeOutput)) {
				state.editsSinceLastVerification = 0
			}

			trackDeliveryEvidence(state, normalized, output.metadata, safeOutput)
			trackDocumentationEvidence(state, normalized, output.metadata)

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

function hasCleanDiagnostics(output: string): boolean {
	if (/no diagnostics found|0 errors?/i.test(output)) return true
	if (/files with errors:\s*0/i.test(output)) return true
	return false
}
