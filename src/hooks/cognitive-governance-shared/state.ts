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
		executePhaseActive: false,
		captureLastWriteRound: 0,
		captureWriteCount: 0,
		captureSignals: [],
		roundCounter: 0,
		evidenceRelevance: new Map(),
		pendingExpires: new Map(),
		citationMap: new Map(),
		editsSinceLastVerification: 0,
		newFilesReadSinceLastFailure: 0,
		knowledgeReadSinceLastFailure: false,
		cognitiveEvidence: [],
		currentLayer: "perception",
		dimensionsCovered: new Set(),
		roundsSinceCaptureNeeded: 0,
		injectionHistory: [],
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
