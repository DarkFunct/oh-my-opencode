import type { SessionCognitiveState } from "./types"

const CAPTURE_COOLDOWN_ROUNDS = 3

export function isCaptureSettled(state: SessionCognitiveState): boolean {
	if (state.captureWriteCount === 0) return false
	return (state.roundCounter - state.captureLastWriteRound) >= CAPTURE_COOLDOWN_ROUNDS
}

export function recordCaptureWrite(state: SessionCognitiveState, filePath: string): void {
	state.captureWriteCount++
	state.captureLastWriteRound = state.roundCounter
	state.captureSignals.push(filePath)
}
