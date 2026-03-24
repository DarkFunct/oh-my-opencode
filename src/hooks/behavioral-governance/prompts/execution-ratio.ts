export function buildExecutionRatioPrompt(
	bashCount: number,
	readCount: number,
	threshold: number,
	required: number,
): string {
	const ratio = readCount > 0 ? (bashCount / readCount).toFixed(1) : "∞"
	return [
		"[EXECUTION RATIO EXCEEDED — READ BEFORE ACTING]",
		"",
		"Bash-to-read ratio exceeded the safety threshold.",
		`  Bash calls: ${bashCount} | Read calls: ${readCount}`,
		`  Ratio: ${ratio}:1 (max allowed: ${threshold}:1)`,
		"",
		"You are executing faster than you are understanding.",
		`Before your next bash call is allowed, perform at least ${required}`,
		"read operations (Read, Grep, Glob, or LSP tools).",
		"",
		"Self-check:",
		"• Have I read the source files relevant to this problem?",
		"• Have I examined the error output from previous commands?",
		"• Do I understand WHY the last command produced its result?",
		"• Am I acting on evidence, or on assumption?",
		"",
		"Read first. Understand. Then act.",
	].join("\n")
}
