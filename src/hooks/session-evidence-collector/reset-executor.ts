import type {
	SessionCognitiveState,
	ResetTrigger,
	ResetAuditEntry,
	ResetScope,
} from "../cognitive-governance-shared/types"
import { log } from "../../shared"

const PRESERVED_KEYS: readonly string[] = [
	"currentLayer",
	"dimensionsCovered",
	"captureLastWriteRound",
	"captureWriteCount",
	"captureSignals",
	"cognitiveEvidence",
	"readFiles",
	"readCount",
	"toolSequence",
] as const

const RESETTABLE_BY_SCOPE: Record<ResetScope, (state: SessionCognitiveState) => string[]> = {
	error_tracking: (state) => {
		const keys: string[] = []
		if (state.detectedErrors.length > 0) {
			state.detectedErrors = []
			keys.push("detectedErrors")
		}
		state.errorSourceTraced = false
		keys.push("errorSourceTraced")
		state.consecutiveFixFailures = 0
		keys.push("consecutiveFixFailures")
		state.fixAttempts = 0
		keys.push("fixAttempts")
		state.lastFixTarget = null
		keys.push("lastFixTarget")
		state.knowledgeReadSinceLastFailure = false
		keys.push("knowledgeReadSinceLastFailure")
		return keys
	},

	build_results: (state) => {
		const keys: string[] = []
		state.lastBuildResult = "unknown"
		keys.push("lastBuildResult")
		state.lastTestResult = "unknown"
		keys.push("lastTestResult")
		return keys
	},

	stale_evidences: (state) => {
		const keys: string[] = []
		if (state.detectedErrors.length > 5) {
			state.detectedErrors = state.detectedErrors.slice(-3)
			keys.push("detectedErrors(trimmed)")
		}
		return keys
	},

	all_resettable: (state) => {
		const keys: string[] = []
		keys.push(...RESETTABLE_BY_SCOPE.error_tracking(state))
		keys.push(...RESETTABLE_BY_SCOPE.build_results(state))
		keys.push(...RESETTABLE_BY_SCOPE.stale_evidences(state))
		return [...new Set(keys)]
	},
}

const auditLog: ResetAuditEntry[] = []

export function executeReset(state: SessionCognitiveState, trigger: ResetTrigger): ResetAuditEntry {
	const resetFn = RESETTABLE_BY_SCOPE[trigger.scope]
	const resetKeys = resetFn(state)

	const entry: ResetAuditEntry = {
		timestamp: Date.now(),
		trigger: trigger.type,
		scope: trigger.scope,
		preservedKeys: [...PRESERVED_KEYS],
		resetKeys,
		evidence: trigger.condition,
	}

	auditLog.push(entry)

	log("[gaia-reset]", {
		trigger: trigger.type,
		scope: trigger.scope,
		resetKeys,
		evidence: trigger.condition,
	})

	return entry
}

export function executeResets(
	state: SessionCognitiveState,
	triggers: ResetTrigger[],
): ResetAuditEntry[] {
	return triggers.map((trigger) => executeReset(state, trigger))
}

export function getResetAuditLog(): readonly ResetAuditEntry[] {
	return auditLog
}
