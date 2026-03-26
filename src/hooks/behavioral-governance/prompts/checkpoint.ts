import type { GovernanceSessionState } from "../types"

export function buildCheckpointReminderSuffix(bashSinceCheckpoint: number): string {
	return [
		"",
		`[CHECKPOINT DUE — ${bashSinceCheckpoint} operations since last save]`,
		"",
		"Write a checkpoint to .sisyphus/checkpoints/ covering:",
		"1. Current problem and diagnosis",
		"2. What was tried and results",
		"3. What has been verified (test matrix)",
		"4. Next planned action",
	].join("\n")
}

export function buildPreCompactCheckpoint(state: GovernanceSessionState): string {
	const authLabel =
		state.sourceCodeAuth.level === "none"
			? "not granted"
			: `${state.sourceCodeAuth.level} (granted at ${state.sourceCodeAuth.grantedAt})`

	const attempts =
		state.attemptLog.length > 0
			? state.attemptLog.slice(-10).join("\n")
			: "(none recorded)"

	const facts =
		state.discoveredFacts.length > 0
			? state.discoveredFacts.slice(-10).join("\n")
			: "(none recorded)"

	return [
		"[STATE CHECKPOINT — PRESERVED THROUGH COMPACTION]",
		"",
		"This checkpoint was injected by the behavioral governance system.",
		"Resume from this state. Do NOT restart analysis from scratch.",
		"",
		"## Counters",
		`Session bash count: ${state.bashCount} | Read count: ${state.readCount}`,
		`Cognitive analysis completed: ${state.cognitiveAnalysisCompleted}`,
		"",
		"## Attempt History",
		attempts,
		"",
		"## Authorization State",
		`Source code modification: ${authLabel}`,
		"",
		"## Discovered Facts",
		facts,
	].join("\n")
}
