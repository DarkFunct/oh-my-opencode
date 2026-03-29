import type { GateResult } from "./tl-gate-evaluator"
import type { GitCommitOutput } from "./git-commit-parser"
import { parseTaskRefs } from "@gaia/kgs-middleware"
import { buildTL05Warning, buildTL07RevertInfo } from "./prompts"

export function evaluateCommitGate(commit: GitCommitOutput): GateResult {
	const result: GateResult = { appendMessages: [] }

	const taskRefs = parseTaskRefs(commit.message)

	if (taskRefs.length === 0) {
		result.appendMessages.push(buildTL05Warning(commit.shortHash, commit.message))
	}

	if (commit.isRevert) {
		result.appendMessages.push(buildTL07RevertInfo(commit.shortHash, commit.message))
	}

	return result
}
