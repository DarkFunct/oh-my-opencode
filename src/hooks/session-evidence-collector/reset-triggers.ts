import type {
	SessionCognitiveState,
	ResetTrigger,
	ResetScope,
	ClassificationResult,
} from "../cognitive-governance-shared/types"

const CONSECUTIVE_FAILURE_THRESHOLD = 3

const USER_RESET_KEYWORDS = [
	/重置上下文/i,
	/reset\s+context/i,
	/清除错误/i,
	/clear\s+errors/i,
	/从头开始/i,
	/start\s+(?:over|fresh)/i,
]

export function detectResetTriggers(
	state: SessionCognitiveState,
	classification?: ClassificationResult,
	userMessage?: string,
): ResetTrigger[] {
	const triggers: ResetTrigger[] = []

	if (detectCognitiveFallback(state)) {
		triggers.push({
			type: "cognitive_fallback",
			condition: `layer degraded: ${state.currentLayer}`,
			scope: "stale_evidences",
		})
	}

	if (detectConsecutiveFailures(state)) {
		triggers.push({
			type: "consecutive_failures",
			condition: `consecutiveFixFailures=${state.consecutiveFixFailures} >= ${CONSECUTIVE_FAILURE_THRESHOLD}`,
			scope: "error_tracking",
		})
	}

	if (detectBuildSuccess(state, classification)) {
		triggers.push({
			type: "build_success",
			condition: "build/test succeeded",
			scope: "error_tracking",
		})
	}

	if (userMessage) {
		const userScope = detectUserResetCommand(userMessage)
		if (userScope) {
			triggers.push({
				type: "user_command",
				condition: `user requested: "${userMessage.slice(0, 50)}"`,
				scope: userScope,
			})
		}
	}

	if (detectMethodologyPhaseAdvance(state)) {
		triggers.push({
			type: "methodology_phase_advance",
			condition: `phase advanced, clearing previous phase temp data`,
			scope: "stale_evidences",
		})
	}

	return triggers
}

function detectCognitiveFallback(state: SessionCognitiveState): boolean {
	const sequence = state.toolSequence
	if (sequence.length < 5) return false

	const recentTools = sequence.slice(-5).map((t) => t.tool)
	const isReadHeavy = recentTools.filter((t) => ["read", "grep", "glob"].includes(t)).length >= 4

	return state.currentLayer !== "perception" && isReadHeavy
}

function detectConsecutiveFailures(state: SessionCognitiveState): boolean {
	return state.consecutiveFixFailures >= CONSECUTIVE_FAILURE_THRESHOLD
}

function detectBuildSuccess(
	state: SessionCognitiveState,
	classification?: ClassificationResult,
): boolean {
	if (classification?.source === "shell_command" && classification.classification === "info" && classification.confidence >= 0.8) {
		return state.lastBuildResult === "success" || state.lastTestResult === "success"
	}
	return false
}

function detectUserResetCommand(message: string): ResetScope | null {
	if (USER_RESET_KEYWORDS.some((p) => p.test(message))) {
		return "all_resettable"
	}
	return null
}

function detectMethodologyPhaseAdvance(_state: SessionCognitiveState): boolean {
	return false
}
