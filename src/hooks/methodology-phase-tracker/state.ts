/**
 * Methodology Phase Tracker — Session State Management
 *
 * Closure-based Map storage. Process-level persistence,
 * survives LLM compaction (lives in memory, not context).
 */

import type { MethodologyPhase, MethodologySessionState, PhaseTransition } from "./types"

const sessions = new Map<string, MethodologySessionState>()

const MAX_TRANSITIONS = 20

function createDefaultState(): MethodologySessionState {
	return {
		currentPhase: "idle",
		completedPhases: new Set<MethodologyPhase>(),
		toolCallCount: 0,
		executeCallCount: 0,
		readCallCount: 0,
		hasActiveTask: false,
		transitions: [],
		lastReminderTime: 0,
	}
}

export function getSessionState(sessionID: string): MethodologySessionState {
	let state = sessions.get(sessionID)
	if (!state) {
		state = createDefaultState()
		sessions.set(sessionID, state)
	}
	return state
}

export function transitionPhase(
	sessionID: string,
	newPhase: MethodologyPhase,
	toolTrigger: string,
): void {
	const state = getSessionState(sessionID)
	if (state.currentPhase === newPhase) return

	const transition: PhaseTransition = {
		from: state.currentPhase,
		to: newPhase,
		timestamp: Date.now(),
		toolTrigger,
	}

	state.transitions.push(transition)
	if (state.transitions.length > MAX_TRANSITIONS) {
		state.transitions.shift()
	}

	state.currentPhase = newPhase
	state.completedPhases.add(newPhase)
}

export function resetCycle(sessionID: string): void {
	const state = getSessionState(sessionID)
	state.currentPhase = "idle"
	state.completedPhases.clear()
	state.toolCallCount = 0
	state.executeCallCount = 0
	state.readCallCount = 0
	state.hasActiveTask = false
}

export function markTaskActive(sessionID: string): void {
	const state = getSessionState(sessionID)
	state.hasActiveTask = true
}

export function incrementToolCall(sessionID: string): void {
	const state = getSessionState(sessionID)
	state.toolCallCount++
}

export function incrementExecuteCall(sessionID: string): void {
	const state = getSessionState(sessionID)
	state.executeCallCount++
}

export function incrementReadCall(sessionID: string): void {
	const state = getSessionState(sessionID)
	state.readCallCount++
}

export function updateReminderTime(sessionID: string): void {
	const state = getSessionState(sessionID)
	state.lastReminderTime = Date.now()
}

export function deleteSession(sessionID: string): void {
	sessions.delete(sessionID)
}
