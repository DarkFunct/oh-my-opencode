import type { PreFlightSessionState } from "./types"

const sessions = new Map<string, PreFlightSessionState>()

function createDefaultState(): PreFlightSessionState {
	return {
		readToolCount: 0,
		planToolCount: 0,
		firstExecuteBlocked: false,
		sessionStartTime: Date.now(),
	}
}

export function getSessionState(sessionID: string): PreFlightSessionState {
	let state = sessions.get(sessionID)
	if (!state) {
		state = createDefaultState()
		sessions.set(sessionID, state)
	}
	return state
}

export function incrementRead(sessionID: string): void {
	getSessionState(sessionID).readToolCount++
}

export function incrementPlan(sessionID: string): void {
	getSessionState(sessionID).planToolCount++
}

export function markBlocked(sessionID: string): void {
	getSessionState(sessionID).firstExecuteBlocked = true
}

export function resetCycle(sessionID: string): void {
	const state = getSessionState(sessionID)
	state.readToolCount = 0
	state.planToolCount = 0
	state.firstExecuteBlocked = false
}

export function deleteSession(sessionID: string): void {
	sessions.delete(sessionID)
}
