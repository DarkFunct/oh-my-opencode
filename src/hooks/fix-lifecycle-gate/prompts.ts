import type { RepeatFixVerdict } from "./repeat-fix-detector"
import type { CaptureVerdict } from "./capture-gate"
import { GATE_PROMPT } from "../../config/gate-prompts"

export function buildBlockMessage(verdict: RepeatFixVerdict): string {
	if (verdict.reason === "consecutive_failures") {
		return GATE_PROMPT.repeatFixConsecutiveFailuresBlock(verdict.fixCount)
	}
	if (verdict.reason === "same_file_repeated") {
		return GATE_PROMPT.repeatFixSameFileBlock(verdict.target ?? "unknown", verdict.fixCount)
	}
	return GATE_PROMPT.repeatFixConsecutiveFailuresBlock(verdict.fixCount)
}

export function buildCaptureBlockMessage(verdict: CaptureVerdict): string {
	return GATE_PROMPT.captureOverdueBlock(verdict.editedFiles, verdict.roundsPending)
}
