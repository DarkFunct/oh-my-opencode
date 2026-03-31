import type { SessionCognitiveState, CognitiveFailure } from "../cognitive-governance-shared/types"
import { computeErrorTraceDepth, computeFixTargetConsistency, isSameDirectionRetry } from "../session-evidence-collector/failure-signals"
import type { FixLifecycleGateConfig } from "./config"
import { DEFAULT_FIX_LIFECYCLE_GATE_CONFIG } from "./config"
import { REMEDIATION } from "../../config/gate-prompts"

export function detectCognitiveFailureBlock(
	state: SessionCognitiveState,
	config: FixLifecycleGateConfig = DEFAULT_FIX_LIFECYCLE_GATE_CONFIG,
): CognitiveFailure | null {
	// F1: Blind Execution — errors detected but source files not read
	if (state.detectedErrors.length > 0 && state.executePhaseActive) {
		const traceDepth = computeErrorTraceDepth(state)
		if (traceDepth === 0) {
			const errorFiles = state.detectedErrors
				.map((e) => e.filePath)
				.filter((f): f is string => !!f)
			const uniqueFiles = [...new Set(errorFiles)]
			return {
				id: "F1",
				name: "Blind Execution",
				action: "block",
				directive: REMEDIATION.f1BlockDirective(uniqueFiles),
			}
		}
	}

	// F3: Unverified Changes — too many edits without running verification
	// Progressive: warn at ≥4 (L3 failure-directives.ts), block at ≥5 (here)
	if (state.editsSinceLastVerification >= config.f3BlockThreshold) {
		return {
			id: "F3",
			name: "Unverified Changes",
			action: "block",
			directive: REMEDIATION.f3BlockDirective(state.editsSinceLastVerification),
		}
	}

	// F5: Same Direction Retry — consecutive failures with no new investigation
	if (isSameDirectionRetry(state)) {
		return {
			id: "F5",
			name: "Same Direction Retry",
			action: "block",
			directive: REMEDIATION.f5BlockDirective(state.consecutiveFixFailures),
		}
	}

	// F2: Fix Direction Mismatch — repeated failures with zero overlap between error source and edit targets
	if (state.consecutiveFixFailures >= config.f2f4BlockThreshold) {
		const consistency = computeFixTargetConsistency(state)
		if (consistency === 0 && state.detectedErrors.length > 0 && state.fileEditHistory.size > 0) {
			const errorFiles = state.detectedErrors
				.map((e) => e.filePath)
				.filter((f): f is string => !!f)
			return {
				id: "F2",
				name: "Fix Direction Mismatch",
				action: "block",
				directive: REMEDIATION.f2BlockDirective([...new Set(errorFiles)], config.f2f4BlockThreshold),
			}
		}
	}

	// F4: Knowledge Blindspot — repeated failures without consulting knowledge base
	if (
		state.consecutiveFixFailures >= config.f2f4BlockThreshold &&
		!state.knowledgeReadSinceLastFailure &&
		state.newFilesReadSinceLastFailure === 0
	) {
		return {
			id: "F4",
			name: "Knowledge Blindspot",
			action: "block",
			directive: REMEDIATION.f4BlockDirective(state.consecutiveFixFailures),
		}
	}

	return null
}
