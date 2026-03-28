import type { SessionCognitiveState } from "../cognitive-governance-shared/types"
import type { FixLifecycleGateConfig } from "./config"
import { DEFAULT_FIX_LIFECYCLE_GATE_CONFIG } from "./config"

export interface RepeatFixVerdict {
	shouldBlock: boolean
	reason: string
	fixCount: number
	target: string | null
}

export function detectRepeatFix(
	state: SessionCognitiveState,
	config: FixLifecycleGateConfig = DEFAULT_FIX_LIFECYCLE_GATE_CONFIG,
): RepeatFixVerdict {
	if (state.consecutiveFixFailures >= config.repeatFixThreshold) {
		return {
			shouldBlock: true,
			reason: "consecutive_failures",
			fixCount: state.consecutiveFixFailures,
			target: state.lastFixTarget,
		}
	}

	if (state.lastFixTarget) {
		const editEntry = state.fileEditHistory.get(state.lastFixTarget)
		if (editEntry && editEntry.count >= config.sameFileFixThreshold) {
			const hasUnresolvedErrors = state.detectedErrors.some(
				(e) => e.filePath === state.lastFixTarget,
			)
			if (hasUnresolvedErrors) {
				return {
					shouldBlock: true,
					reason: "same_file_repeated",
					fixCount: editEntry.count,
					target: state.lastFixTarget,
				}
			}
		}
	}

	return {
		shouldBlock: false,
		reason: "ok",
		fixCount: state.fixAttempts,
		target: state.lastFixTarget,
	}
}

export function incrementConsecutiveFailure(state: SessionCognitiveState): void {
	state.consecutiveFixFailures++
}

export function resetConsecutiveFailure(state: SessionCognitiveState): void {
	state.consecutiveFixFailures = 0
}
