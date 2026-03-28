/**
 * Behavioral Governance Hook — Type Definitions
 *
 * Session-scoped state for the governance sub-modules:
 * F1 (cognitive gate), F2 (execution ratio), F3 (source auth),
 * F5/F6 (checkpoint & pre-compact).
 */

export type AuthorizationLevel = "none" | "once" | "task" | "session"

export interface SourceCodeAuthorization {
	level: AuthorizationLevel
	grantedAt?: number
	taskId?: string
	pendingPath?: string
	pendingOperation?: string
}

export interface GovernanceSessionState {
	// F1: Five-dimension cognitive analysis
	cognitiveAnalysisCompleted: boolean

	// F2: Execution ratio (bash vs read)
	bashCount: number
	readCount: number

	// F3: Source code modification authorization
	sourceCodeAuth: SourceCodeAuthorization

	// F5+F6: Checkpoint tracking
	bashSinceCheckpoint: number
	lastCheckpointTime?: number
	attemptLog: string[]
	discoveredFacts: string[]
}

export interface GovernanceConfig {
	/** bash:read ratio threshold (default 3) */
	ratioThreshold: number
	/** Bash calls between checkpoint reminders (default 15) */
	checkpointInterval: number
	minBashSamplesForRatioGate: number
	cognitiveMarkersThreshold: number
	/** Source code path patterns to protect */
	protectedPathPatterns: RegExp[]
}

export const DEFAULT_GOVERNANCE_CONFIG: GovernanceConfig = {
	ratioThreshold: 3,
	checkpointInterval: 15,
	minBashSamplesForRatioGate: 6,
	cognitiveMarkersThreshold: 3,
	protectedPathPatterns: [
		// SVN/Git repo source files (PHP, Go, JS, TS, Vue, etc.)
		/\b(svn-repo|git-repo)\b.*\.(php|go|js|ts|vue|svelte|json|yaml|yml|conf|ini|env)$/i,
		// Workspace symlinks pointing to source (not _meta, not .opencode, not .sisyphus)
		/\/workspace\/(?!.*(\/_meta\/|\/\.opencode\/|\/\.sisyphus\/)).*\.(php|go|js|ts|vue|svelte)$/i,
	],
}
