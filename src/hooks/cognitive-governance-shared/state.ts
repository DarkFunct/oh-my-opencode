import type { SessionCognitiveState } from "./types"

const sessions = new Map<string, SessionCognitiveState>()

function createDefaultState(): SessionCognitiveState {
	return {
		detectedErrors: [],
		errorSourceTraced: false,
		fileEditHistory: new Map(),
		fixAttempts: 0,
		consecutiveFixFailures: 0,
		lastFixTarget: null,
		lastBuildResult: "unknown",
		lastTestResult: "unknown",
		readFiles: new Set(),
		readCount: 0,
		grepCount: 0,
		toolSequence: [],
		cognitiveEvidence: [],
		currentLayer: "perception",
		dimensionsCovered: new Set(),
	}
}

export function getCognitiveState(sessionID: string): SessionCognitiveState {
	let state = sessions.get(sessionID)
	if (!state) {
		state = createDefaultState()
		sessions.set(sessionID, state)
	}
	return state
}

export function deleteCognitiveSession(sessionID: string): void {
	sessions.delete(sessionID)
}

export function hasCognitiveSession(sessionID: string): boolean {
	return sessions.has(sessionID)
}
