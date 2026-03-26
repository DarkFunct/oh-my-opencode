const activeModes = new Map<string, string>()

export function setModeMessage(sessionID: string, message: string): void {
	activeModes.set(sessionID, message)
}

export function getModeMessage(sessionID: string): string | undefined {
	return activeModes.get(sessionID)
}

export function clearModeMessage(sessionID: string): void {
	activeModes.delete(sessionID)
}
