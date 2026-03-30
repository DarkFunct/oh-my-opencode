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
	// II-2: agent_output + file_modification signals
	editSuccess?: boolean
	taskStatus?: "completed" | "error" | "pending"
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

// D-010 Mechanism 1: Dual-track fusion scoring types

export interface StructuralScoring {
	recency: number // max(0, 1 - (currentRound - evidenceRound) / decayWindow)
	citation: number // citationCount / maxExpectedCitations, capped at 1.0
	superseded: number // 0 if newer version exists for same file, 1 otherwise
}

export interface SemanticEvaluation {
	taskRelevance: number // 0-1
	causalContribution: number // 0-1
	evidence: string[] // ≥1 entry
}

export interface FusionConfig {
	weights: {
		structural: number // default 0.6
		semantic: number // default 0.4
	}
	thresholds: {
		keep: number // ≥ this: keep + inject (default 0.6)
		noInject: number // ≥ this but < keep: keep but stop injecting (default 0.3)
	}
	expireGuard: {
		margin: number // expire threshold protection margin (default 0.05)
		maxDeferRounds: number // max deferred rounds (default 2)
	}
	semanticSampling: {
		enabled: boolean
		interval: number // every N rounds
	}
	fallback: "structural_only"
}

export type RelevanceAction = "keep" | "no_inject" | "pending_expire" | "expire"

export interface RelevanceResult {
	composite: number
	action: RelevanceAction
	trackUsed: "dual" | "structural_only"
}

export interface PendingExpireEntry {
	contentId: string
	firstExpireScore: number
	deferredRounds: number
	trackUsed: "dual" | "structural_only"
	reason: string
}

export interface DetectedError {
	pattern: string
	rawMessage: string
	tool: string
	timestamp: number
	round?: number // round when this error was detected
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

// D-010 Mechanism 3: Cognitive failure detection types

export type CognitiveFailureId = "F1" | "F2" | "F3" | "F4" | "F5"

export interface CognitiveFailure {
	id: CognitiveFailureId
	name: string
	action: "block" | "warn"
	directive: string
}

// DV-01~03: Delivery Verification evidence
export interface DeliveryEvidence {
	lastBuildTimestamp: number | null
	lastBuildCommand: string | null
	buildExitCode: number | null
	lastCodeChangeTimestamp: number | null
	codeChangesSinceBuild: number
	lastTestTimestamp: number | null
	lastTestResult: "pass" | "fail" | "unknown"
	testsSinceCodeChange: boolean
}

// DG-01~04: Documentation Governance evidence
export interface DocumentationEvidence {
	publicInterfaceChanges: Array<{
		filePath: string
		timestamp: number
		changeType: "export" | "config" | "type" | "hook" | "api"
	}>
	docChanges: Array<{
		filePath: string
		timestamp: number
	}>
	codeChangesWithoutDocUpdate: number
	lastDocChangeTimestamp: number | null
}

// V-1: Injection effectiveness tracking
export interface InjectionEvent {
	failureId: CognitiveFailureId | "cognitive_directive"
	round: number
	timestamp: number
	resolved: boolean
	resolvedRound?: number
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

	// L1: Capture tracking (P-016 cooldown mechanism)
	executePhaseActive: boolean
	captureLastWriteRound: number
	captureWriteCount: number
	captureSignals: string[]

	// L1.5: Context relevance scoring
	roundCounter: number
	evidenceRelevance: Map<string, RelevanceResult>
	pendingExpires: Map<string, PendingExpireEntry>
	citationMap: Map<string, number>

	// L1: Cognitive failure detection counters
	editsSinceLastVerification: number
	newFilesReadSinceLastFailure: number
	knowledgeReadSinceLastFailure: boolean

	// L3: Cognitive assessment
	cognitiveEvidence: CognitiveEvidence[]
	currentLayer: CognitiveLayer
	dimensionsCovered: Set<MethodologyDimension>
	roundsSinceCaptureNeeded: number

	// V-1: Injection effectiveness tracking
	injectionHistory: InjectionEvent[]

	// DV/DG evidence (L1 delivery + documentation tracking)
	deliveryEvidence: DeliveryEvidence
	documentationEvidence: DocumentationEvidence
}
