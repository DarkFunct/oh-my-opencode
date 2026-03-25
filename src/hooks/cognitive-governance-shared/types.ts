export type CognitiveLayer = "perception" | "understanding" | "rationality"

export type MethodologyDimension =
	| "technical"
	| "empirical"
	| "theoretical"
	| "engineering"
	| "philosophical"

// D-010 Signal Classification Engine types

export type SourceType =
	| "shell_command"
	| "build_output"
	| "test_output"
	| "search_result"
	| "file_content"
	| "file_modification"
	| "lsp_structured"
	| "web_content"
	| "agent_output"
	| "user_message"
	| "unknown"

export interface StructuralSignals {
	exitCode?: number
	diagnosticCount?: number
	matchCount?: number
	filePath?: string
	lineNumber?: number
}

export type SignalClassification = "error" | "warning" | "info" | "ambiguous"

export interface ClassificationResult {
	classification: SignalClassification
	confidence: number
	source: SourceType
	evidence: string[]
}

export interface SourceAwareRule {
	sourceTypes: SourceType[]
	pattern: RegExp
	classification: "error" | "warning" | "info"
	negationPatterns?: RegExp[]
	requireExitCode?: number
}

export interface TextMatchResult {
	classification: "error" | "warning" | "info"
	pattern: string
	rule: SourceAwareRule
}

// D-010 Mechanism 2: Context Reset types

export type ResetTriggerType =
	| "cognitive_fallback"
	| "consecutive_failures"
	| "build_success"
	| "user_command"
	| "methodology_phase_advance"

export interface ResetTrigger {
	type: ResetTriggerType
	condition: string
	scope: ResetScope
}

export type ResetScope = "error_tracking" | "build_results" | "stale_evidences" | "all_resettable"

export interface ResetAuditEntry {
	timestamp: number
	trigger: ResetTriggerType
	scope: ResetScope
	preservedKeys: string[]
	resetKeys: string[]
	evidence: string
}

export interface DetectedError {
	pattern: string
	rawMessage: string
	tool: string
	timestamp: number
	filePath?: string
	source?: SourceType
	confidence?: number
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

	// L1: Capture tracking
	executePhaseActive: boolean
	captureCompleted: boolean
	captureSignals: string[]

	// L3: Cognitive assessment
	cognitiveEvidence: CognitiveEvidence[]
	currentLayer: CognitiveLayer
	dimensionsCovered: Set<MethodologyDimension>
	roundsSinceCaptureNeeded: number
}
