export interface GitCommitOutput {
	shortHash: string
	message: string
	branch: string
	isRevert: boolean
}

// Format: [branch-name short-hash] commit message  |  [branch (root-commit) short-hash] message
const GIT_COMMIT_PATTERN = /\[([^\s)]+?)(?:\s+\(root-commit\))?\s+([a-f0-9]{7,12})\]\s+(.+)/

const REVERT_PREFIX = /^Revert\s+"/i

export function parseGitCommitOutput(bashOutput: string): GitCommitOutput | null {
	if (!bashOutput) return null

	const match = GIT_COMMIT_PATTERN.exec(bashOutput)
	if (!match) return null

	const [, branch, shortHash, message] = match
	return {
		shortHash,
		message: message.trim(),
		branch,
		isRevert: REVERT_PREFIX.test(message),
	}
}
