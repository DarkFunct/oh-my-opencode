import type { PostExecutionSessionState } from "./types"

const sessions = new Map<string, PostExecutionSessionState>()

function createDefaultState(): PostExecutionSessionState {
	return {
		executeStepCount: 0,
		lastVerificationReminder: 0,
		filesModified: new Set<string>(),
		bashCommandCount: 0,
	}
}

export function getSessionState(sessionID: string): PostExecutionSessionState {
	let state = sessions.get(sessionID)
	if (!state) {
		state = createDefaultState()
		sessions.set(sessionID, state)
	}
	return state
}

export function incrementStep(sessionID: string): void {
	getSessionState(sessionID).executeStepCount++
}

export function addModifiedFile(sessionID: string, filePath: string): void {
	getSessionState(sessionID).filesModified.add(filePath)
}

export function incrementBash(sessionID: string): void {
	getSessionState(sessionID).bashCommandCount++
}

export function updateReminderTime(sessionID: string): void {
	getSessionState(sessionID).lastVerificationReminder = Date.now()
}

export function deleteSession(sessionID: string): void {
	sessions.delete(sessionID)
}
