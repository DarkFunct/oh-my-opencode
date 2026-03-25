import type { SessionCognitiveState, CognitiveLayer, MethodologyDimension, DetectedError } from "../cognitive-governance-shared/types"

export interface CognitiveAssessment {
	currentLayer: CognitiveLayer
	dimensionsCovered: MethodologyDimension[]
	dimensionsGap: MethodologyDimension[]
	errorCount: number
	unresolvedErrors: number
	fixAttempts: number
	readCount: number
	grepCount: number
	editedFilesCount: number
	hasVerification: boolean
	captureNeeded: boolean
	captureUrgency: "none" | "reminder" | "warning" | "critical"
}

const ALL_DIMENSIONS: MethodologyDimension[] = [
	"technical", "empirical", "theoretical", "engineering", "philosophical",
]

export function assessCognition(state: SessionCognitiveState): CognitiveAssessment {
	const covered = Array.from(state.dimensionsCovered)
	const gap = ALL_DIMENSIONS.filter((d) => !state.dimensionsCovered.has(d))

	const hasVerification =
		state.lastBuildResult === "success" ||
		state.lastTestResult === "success"

	const captureNeeded = state.executePhaseActive && !state.captureCompleted && state.fileEditHistory.size >= 3
	const captureUrgency = deriveCaptureUrgency(state, captureNeeded)

	return {
		currentLayer: state.currentLayer,
		dimensionsCovered: covered,
		dimensionsGap: gap,
		errorCount: state.detectedErrors.length,
		unresolvedErrors: state.detectedErrors.filter((e) => !isErrorLikelyResolved(e, state)).length,
		fixAttempts: state.fixAttempts,
		readCount: state.readCount,
		grepCount: state.grepCount,
		editedFilesCount: state.fileEditHistory.size,
		hasVerification,
		captureNeeded,
		captureUrgency,
	}
}

function deriveCaptureUrgency(
	state: SessionCognitiveState,
	captureNeeded: boolean,
): "none" | "reminder" | "warning" | "critical" {
	if (!captureNeeded) return "none"
	const rounds = state.roundsSinceCaptureNeeded
	if (rounds >= 3) return "critical"
	if (rounds >= 2) return "warning"
	return "reminder"
}

function buildErrorId(error: DetectedError): string {
	const pathPart = error.filePath ?? "unknown"
	return `${error.tool}:${pathPart}:${error.timestamp}`
}

function isErrorLikelyResolved(
	error: DetectedError,
	state: SessionCognitiveState,
): boolean {
	const relevance = state.evidenceRelevance.get(buildErrorId(error))
	if (relevance && (relevance.action === "expire")) {
		return true
	}

	if (error.filePath) {
		const editEntry = state.fileEditHistory.get(error.filePath)
		return !!editEntry && editEntry.lastEditTimestamp >= error.timestamp
	}
	if (error.pattern === "compilation" || error.pattern === "process" || error.pattern === "resolution") {
		return state.lastBuildResult === "success"
	}
	if (error.pattern === "test") {
		return state.lastTestResult === "success"
	}
	return false
}

export function determineCognitiveLayer(state: SessionCognitiveState): CognitiveLayer {
	if (state.readCount < 2) {
		return "perception"
	}

	if (state.dimensionsCovered.size < 2) {
		return "perception"
	}

	const hasExecution = state.fileEditHistory.size > 0
	if (!hasExecution) {
		return "understanding"
	}

	const hasVerification =
		state.lastBuildResult !== "unknown" ||
		state.lastTestResult !== "unknown"

	if (hasVerification) {
		return "rationality"
	}

	return "understanding"
}
