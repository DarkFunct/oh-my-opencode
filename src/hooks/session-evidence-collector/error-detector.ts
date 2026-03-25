import type { DetectedError } from "../cognitive-governance-shared/types"

const ERROR_PATTERNS: Array<{ regex: RegExp; type: string }> = [
	{ regex: /TypeError|ReferenceError|SyntaxError|RangeError/i, type: "runtime" },
	{ regex: /ENOENT|EACCES|EPERM|EISDIR/i, type: "filesystem" },
	{ regex: /exit code [1-9]\d*/i, type: "process" },
	{ regex: /Cannot find module ['"]|Module not found:/i, type: "resolution" },
	{ regex: /compilation error|type error|tsc.*error/i, type: "compilation" },
	{ regex: /tests?\s+failed|assertion error|AssertionError/i, type: "test" },
]

const FIX_SIGNAL_PATTERNS = [
	/(?:fix|修复|修正|revert|回退|rollback|undo)/i,
	/(?:retry|重试|再试|again)/i,
	/(?:attempt|try again|one more)/i,
]

export function detectErrors(
	output: string,
	tool: string,
	filePath?: string,
): DetectedError[] {
	const errors: DetectedError[] = []
	const now = Date.now()

	for (const { regex, type } of ERROR_PATTERNS) {
		const match = output.match(regex)
		if (match) {
			errors.push({
				pattern: type,
				rawMessage: match[0],
				tool,
				timestamp: now,
				filePath,
			})
		}
	}

	return errors
}

export function isFixAttempt(output: string): boolean {
	return FIX_SIGNAL_PATTERNS.some((p) => p.test(output))
}

export function extractFilePath(
	tool: string,
	args: Record<string, unknown>,
): string | undefined {
	if (tool === "edit" || tool === "write" || tool === "read") {
		return typeof args.filePath === "string" ? args.filePath : undefined
	}
	if (tool === "bash") {
		return undefined
	}
	return undefined
}
