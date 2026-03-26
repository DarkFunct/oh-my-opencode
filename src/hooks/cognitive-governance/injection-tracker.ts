import type { CognitiveFailureId, InjectionEvent, SessionCognitiveState } from "../cognitive-governance-shared/types"

const RESOLUTION_WINDOW = 5

export function recordInjection(
	state: SessionCognitiveState,
	failureId: CognitiveFailureId | "cognitive_directive",
): void {
	state.injectionHistory.push({
		failureId,
		round: state.roundCounter,
		timestamp: Date.now(),
		resolved: false,
	})
}

export function checkInjectionResolutions(state: SessionCognitiveState): void {
	for (const event of state.injectionHistory) {
		if (event.resolved) continue
		if (state.roundCounter - event.round > RESOLUTION_WINDOW) continue

		if (isResolved(state, event)) {
			event.resolved = true
			event.resolvedRound = state.roundCounter
		}
	}
}

function isResolved(state: SessionCognitiveState, event: InjectionEvent): boolean {
	switch (event.failureId) {
		case "F1":
			return state.readCount > 0 && state.errorSourceTraced
		case "F3":
			return state.editsSinceLastVerification === 0
		case "F5":
			return state.newFilesReadSinceLastFailure > 0
		case "F2":
		case "F4":
		case "cognitive_directive":
			return false
		default:
			return false
	}
}

export interface InjectionEffectivenessStats {
	total: number
	resolved: number
	unresolved: number
	expired: number
	resolutionRate: number
}

export function computeEffectiveness(state: SessionCognitiveState): InjectionEffectivenessStats {
	let resolved = 0
	let unresolved = 0
	let expired = 0

	for (const event of state.injectionHistory) {
		if (event.resolved) {
			resolved++
		} else if (state.roundCounter - event.round > RESOLUTION_WINDOW) {
			expired++
		} else {
			unresolved++
		}
	}

	const total = state.injectionHistory.length
	return {
		total,
		resolved,
		unresolved,
		expired,
		resolutionRate: total > 0 ? resolved / total : 0,
	}
}
