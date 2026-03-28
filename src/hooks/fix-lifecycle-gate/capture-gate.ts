import type { SessionCognitiveState } from "../cognitive-governance-shared/types"
import { isCaptureSettled } from "../cognitive-governance-shared/capture-cooldown"
import type { FixLifecycleGateConfig } from "./config"
import { DEFAULT_FIX_LIFECYCLE_GATE_CONFIG } from "./config"

export interface CaptureVerdict {
	shouldBlock: boolean
	reason: "capture_overdue" | "ok"
	roundsPending: number
	editedFiles: number
}

export function detectCaptureViolation(
	state: SessionCognitiveState,
	config: FixLifecycleGateConfig = DEFAULT_FIX_LIFECYCLE_GATE_CONFIG,
): CaptureVerdict {
	if (!state.executePhaseActive || isCaptureSettled(state)) {
		return { shouldBlock: false, reason: "ok", roundsPending: 0, editedFiles: 0 }
	}

	const editedFiles = state.fileEditHistory.size
	if (editedFiles < config.executeActivityThreshold) {
		return { shouldBlock: false, reason: "ok", roundsPending: 0, editedFiles }
	}

	if (state.roundsSinceCaptureNeeded >= config.captureHardBlockThreshold) {
		return {
			shouldBlock: true,
			reason: "capture_overdue",
			roundsPending: state.roundsSinceCaptureNeeded,
			editedFiles,
		}
	}

	return { shouldBlock: false, reason: "ok", roundsPending: state.roundsSinceCaptureNeeded, editedFiles }
}
