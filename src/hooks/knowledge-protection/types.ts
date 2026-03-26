export interface RuleTriggerCondition {
	readonly arg: string
	readonly pattern: string
}

export interface RuleTrigger {
	readonly tools: readonly string[]
	readonly arg: string
	readonly pattern: string
	readonly conditions?: readonly RuleTriggerCondition[]
}

export interface PitfallRule {
	readonly id: string
	readonly severity: "info" | "warning" | "error"
	readonly trigger: RuleTrigger
	readonly message: string
	readonly fix: string
	readonly ref: string
}

export interface RuleFile {
	readonly version: number
	readonly rules: readonly PitfallRule[]
}

export interface MatchResult {
	readonly rule: PitfallRule
	readonly matchedArg: string
	readonly matchedValue: string
}

export interface BashErrorRecord {
	readonly command: string
	readonly exitCode: number
	readonly timestamp: number
}

export interface ProtectionState {
	lastBashErrors: BashErrorRecord[]
	knowledgeCaptureNeeded: boolean
	captureContext: string | null
}
