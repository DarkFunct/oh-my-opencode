import type { SessionCognitiveState } from "../cognitive-governance-shared/types"

const CAPTURE_HARD_BLOCK_THRESHOLD = 4
const EXECUTE_ACTIVITY_THRESHOLD = 3

export interface CaptureVerdict {
	shouldBlock: boolean
	reason: "capture_overdue" | "ok"
	roundsPending: number
	editedFiles: number
}

export function detectCaptureViolation(state: SessionCognitiveState): CaptureVerdict {
	if (!state.executePhaseActive || state.captureCompleted) {
		return { shouldBlock: false, reason: "ok", roundsPending: 0, editedFiles: 0 }
	}

	const editedFiles = state.fileEditHistory.size
	if (editedFiles < EXECUTE_ACTIVITY_THRESHOLD) {
		return { shouldBlock: false, reason: "ok", roundsPending: 0, editedFiles }
	}

	if (state.roundsSinceCaptureNeeded >= CAPTURE_HARD_BLOCK_THRESHOLD) {
		return {
			shouldBlock: true,
			reason: "capture_overdue",
			roundsPending: state.roundsSinceCaptureNeeded,
			editedFiles,
		}
	}

	return { shouldBlock: false, reason: "ok", roundsPending: state.roundsSinceCaptureNeeded, editedFiles }
}
