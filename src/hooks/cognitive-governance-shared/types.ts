export type CognitiveLayer = "perception" | "understanding" | "rationality"

export type MethodologyDimension =
	| "technical"
	| "empirical"
	| "theoretical"
	| "engineering"
	| "philosophical"

export interface DetectedError {
	pattern: string
	rawMessage: string
	tool: string
	timestamp: number
	filePath?: string
}

export interface FileEditEntry {
	count: number
	lastEditTimestamp: number
	tools: string[]
}

export interface CognitiveEvidence {
	layer: CognitiveLayer
	dimension: MethodologyDimension
	signal: string
	timestamp: number
}

export interface ToolCall {
	tool: string
	timestamp: number
	filePath?: string
}

export interface SessionCognitiveState {
	// L1: Evidence collection
	detectedErrors: DetectedError[]
	errorSourceTraced: boolean
	fileEditHistory: Map<string, FileEditEntry>
	fixAttempts: number
	consecutiveFixFailures: number
	lastFixTarget: string | null
	lastBuildResult: "success" | "fail" | "unknown"
	lastTestResult: "success" | "fail" | "unknown"
	readFiles: Set<string>
	readCount: number
	grepCount: number
	toolSequence: ToolCall[]

	// L3: Cognitive assessment
	cognitiveEvidence: CognitiveEvidence[]
	currentLayer: CognitiveLayer
	dimensionsCovered: Set<MethodologyDimension>
}
