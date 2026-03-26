/**
 * Behavioral Governance — Session State Management
 *
 * Closure-based Map storage. Persists across LLM compaction
 * (lives in process memory, not LLM context).
 */

import type { GovernanceSessionState, SourceCodeAuthorization } from "./types"

const sessions = new Map<string, GovernanceSessionState>()

function createDefaultState(): GovernanceSessionState {
	return {
		cognitiveAnalysisCompleted: false,
		bashCount: 0,
		readCount: 0,
		sourceCodeAuth: { level: "none" },
		bashSinceCheckpoint: 0,
		attemptLog: [],
		discoveredFacts: [],
	}
}

export function getSessionState(sessionID: string): GovernanceSessionState {
	let state = sessions.get(sessionID)
	if (!state) {
		state = createDefaultState()
		sessions.set(sessionID, state)
	}
	return state
}

export function resetSourceCodeAuth(sessionID: string): void {
	const state = getSessionState(sessionID)
	state.sourceCodeAuth = { level: "none" }
}

export function grantSourceCodeAuth(
	sessionID: string,
	level: SourceCodeAuthorization["level"],
	taskId?: string,
): void {
	const state = getSessionState(sessionID)
	state.sourceCodeAuth = {
		level,
		grantedAt: Date.now(),
		taskId: level === "task" ? taskId : undefined,
	}
}

export function consumeOnceAuthorization(sessionID: string): void {
	const state = getSessionState(sessionID)
	if (state.sourceCodeAuth.level === "once") {
		state.sourceCodeAuth = { level: "none" }
	}
}

export function incrementBashCount(sessionID: string): void {
	const state = getSessionState(sessionID)
	state.bashCount++
	state.bashSinceCheckpoint++
}

export function incrementReadCount(sessionID: string): void {
	const state = getSessionState(sessionID)
	state.readCount++
}

export function markCognitiveAnalysisComplete(sessionID: string): void {
	const state = getSessionState(sessionID)
	state.cognitiveAnalysisCompleted = true
}

export function resetCheckpointCounter(sessionID: string): void {
	const state = getSessionState(sessionID)
	state.bashSinceCheckpoint = 0
	state.lastCheckpointTime = Date.now()
}

export function addDiscoveredFact(sessionID: string, fact: string): void {
	const state = getSessionState(sessionID)
	if (state.discoveredFacts.length < 50) {
		state.discoveredFacts.push(fact)
	}
}

export function deleteSession(sessionID: string): void {
	sessions.delete(sessionID)
}
