import type { TaskLifecycleSessionState } from "./types"

const sessions = new Map<string, TaskLifecycleSessionState>()

function createDefaultState(): TaskLifecycleSessionState {
	return {
		hasCreatedTask: false,
		editWriteCallCount: 0,
		taskCompletedCount: 0,
		lastReminderTime: 0,
		activeTaskIds: new Set<string>(),
		hasInProgressTask: false,
		editsSinceLastTaskUpdate: 0,
	}
}

export function getSessionState(sessionID: string): TaskLifecycleSessionState {
	let state = sessions.get(sessionID)
	if (!state) {
		state = createDefaultState()
		sessions.set(sessionID, state)
	}
	return state
}

export function markTaskCreated(sessionID: string, taskId?: string): void {
	const state = getSessionState(sessionID)
	state.hasCreatedTask = true
	if (taskId) {
		state.activeTaskIds.add(taskId)
	}
}

export function markTaskCompleted(sessionID: string, taskId?: string): void {
	const state = getSessionState(sessionID)
	state.taskCompletedCount++
	if (taskId) {
		state.activeTaskIds.delete(taskId)
	}
}

export function incrementEditWrite(sessionID: string): void {
	const state = getSessionState(sessionID)
	state.editWriteCallCount++
	state.editsSinceLastTaskUpdate++
}

export function markTaskInProgress(sessionID: string): void {
	const state = getSessionState(sessionID)
	state.hasInProgressTask = true
	state.editsSinceLastTaskUpdate = 0
}

export function resetEditsSinceUpdate(sessionID: string): void {
	const state = getSessionState(sessionID)
	state.editsSinceLastTaskUpdate = 0
}

export function updateReminderTime(sessionID: string): void {
	const state = getSessionState(sessionID)
	state.lastReminderTime = Date.now()
}

export function deleteSession(sessionID: string): void {
	sessions.delete(sessionID)
}
