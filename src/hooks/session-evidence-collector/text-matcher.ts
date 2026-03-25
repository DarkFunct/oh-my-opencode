import type { SourceType, SourceAwareRule, StructuralSignals, TextMatchResult } from "../cognitive-governance-shared/types"

const SHELL_ERROR_RULES: SourceAwareRule[] = [
	{
		sourceTypes: ["shell_command", "build_output"],
		pattern: /error\s*TS\d+:/i,
		classification: "error",
		requireExitCode: 1,
	},
	{
		sourceTypes: ["shell_command"],
		pattern: /command not found/i,
		classification: "error",
	},
	{
		sourceTypes: ["shell_command", "build_output"],
		pattern: /Cannot find module ['"]|Module not found:/i,
		classification: "error",
		requireExitCode: 1,
	},
	{
		sourceTypes: ["shell_command"],
		pattern: /ENOENT|EACCES|EPERM|EISDIR/i,
		classification: "error",
		negationPatterns: [/No such file or directory.*\.(log|tmp|cache)/i],
	},
	{
		sourceTypes: ["shell_command", "build_output", "test_output"],
		pattern: /TypeError|ReferenceError|SyntaxError|RangeError/,
		classification: "error",
		requireExitCode: 1,
		negationPatterns: [
			/matching.*TypeError/i,
			/search.*SyntaxError/i,
			/grep.*ReferenceError/i,
			/found \d+ match/i,
		],
	},
	{
		sourceTypes: ["shell_command", "build_output"],
		pattern: /compilation\s+error|compile\s+error/i,
		classification: "error",
		requireExitCode: 1,
	},
	{
		sourceTypes: ["shell_command", "test_output"],
		pattern: /tests?\s+failed|FAIL\s+\w/i,
		classification: "error",
		requireExitCode: 1,
	},
	{
		sourceTypes: ["shell_command"],
		pattern: /fatal:|panic:|segmentation fault/i,
		classification: "error",
	},
]

const LSP_RULES: SourceAwareRule[] = [
	{
		sourceTypes: ["lsp_structured"],
		pattern: /error/i,
		classification: "error",
	},
	{
		sourceTypes: ["lsp_structured"],
		pattern: /warning/i,
		classification: "warning",
	},
]

const FILE_MODIFICATION_RULES: SourceAwareRule[] = [
	{
		sourceTypes: ["file_modification"],
		pattern: /oldString not found|Found multiple matches/i,
		classification: "error",
	},
]

const ALL_RULES: SourceAwareRule[] = [...SHELL_ERROR_RULES, ...LSP_RULES, ...FILE_MODIFICATION_RULES]

const NEVER_ERROR_SOURCES: Set<SourceType> = new Set([
	"search_result",
	"file_content",
	"web_content",
	"user_message",
])

export function matchTextSignals(
	source: SourceType,
	output: string,
	signals: StructuralSignals,
): TextMatchResult[] {
	if (source === "unknown") return []
	if (NEVER_ERROR_SOURCES.has(source)) return []

	const results: TextMatchResult[] = []

	for (const rule of ALL_RULES) {
		if (!rule.sourceTypes.includes(source)) continue

		if (rule.requireExitCode !== undefined && signals.exitCode !== rule.requireExitCode) {
			if (signals.exitCode === 0) continue
			if (signals.exitCode === undefined && rule.requireExitCode !== 0) continue
		}

		const match = output.match(rule.pattern)
		if (!match) continue

		if (rule.negationPatterns?.some((neg) => neg.test(output))) continue

		results.push({
			classification: rule.classification,
			pattern: match[0],
			rule,
		})
	}

	return results
}

const FIX_SIGNAL_PATTERNS = [
	/(?:fix|修复|修正|revert|回退|rollback|undo)/i,
	/(?:retry|重试|再试|again)/i,
	/(?:attempt|try again|one more)/i,
]

export function isFixAttempt(output: string): boolean {
	return FIX_SIGNAL_PATTERNS.some((p) => p.test(output))
}
