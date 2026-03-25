export interface PreFlightSessionState {
	readToolCount: number
	planToolCount: number
	firstExecuteBlocked: boolean
	sessionStartTime: number
}

export interface PreFlightConfig {
	minReadBeforeExecute: number
	graceWindowSeconds: number
}

export const DEFAULT_PRE_FLIGHT_CONFIG: PreFlightConfig = {
	minReadBeforeExecute: 1,
	graceWindowSeconds: 30,
}
