import { describe, expect, test } from "bun:test"
import { evaluateCommitGate } from "./commit-gate"
import type { GitCommitOutput } from "./git-commit-parser"

describe("evaluateCommitGate", () => {
	describe("TL-05: commit without task reference", () => {
		test("warns when commit message has no task refs", () => {
			const commit: GitCommitOutput = {
				shortHash: "abc1234",
				message: "feat: add new feature",
				branch: "main",
				isRevert: false,
			}
			const result = evaluateCommitGate(commit)
			expect(result.appendMessages.length).toBe(1)
			expect(result.appendMessages[0]).toContain("TL-05")
			expect(result.appendMessages[0]).toContain("abc1234")
			expect(result.hardBlock).toBeUndefined()
		})

		test("no warning when commit message contains T-{uuid} task ref", () => {
			const commit: GitCommitOutput = {
				shortHash: "abc1234",
				message: "[T-550e8400-e29b-41d4-a716-446655440000] feat: add feature",
				branch: "main",
				isRevert: false,
			}
			const result = evaluateCommitGate(commit)
			expect(result.appendMessages.length).toBe(0)
		})

		test("no warning when commit message contains bare UUID ref", () => {
			const commit: GitCommitOutput = {
				shortHash: "abc1234",
				message: "fix auth bug (550e8400-e29b-41d4-a716-446655440000)",
				branch: "main",
				isRevert: false,
			}
			const result = evaluateCommitGate(commit)
			expect(result.appendMessages.length).toBe(0)
		})
	})

	describe("TL-07: revert commit detection", () => {
		test("injects revert info for revert commits without task ref", () => {
			const commit: GitCommitOutput = {
				shortHash: "def5678",
				message: 'Revert "feat: add broken feature"',
				branch: "main",
				isRevert: true,
			}
			const result = evaluateCommitGate(commit)
			expect(result.appendMessages.length).toBe(2)
			expect(result.appendMessages[0]).toContain("TL-05")
			expect(result.appendMessages[1]).toContain("TL-07")
			expect(result.appendMessages[1]).toContain("revert")
			expect(result.hardBlock).toBeUndefined()
		})

		test("injects only revert info when revert commit has task ref", () => {
			const commit: GitCommitOutput = {
				shortHash: "def5678",
				message: 'Revert "T-550e8400-e29b-41d4-a716-446655440000 feat: something"',
				branch: "main",
				isRevert: true,
			}
			const result = evaluateCommitGate(commit)
			expect(result.appendMessages.length).toBe(1)
			expect(result.appendMessages[0]).toContain("TL-07")
		})

		test("no revert info for normal commits", () => {
			const commit: GitCommitOutput = {
				shortHash: "abc1234",
				message: "[T-550e8400-e29b-41d4-a716-446655440000] feat: normal commit",
				branch: "main",
				isRevert: false,
			}
			const result = evaluateCommitGate(commit)
			expect(result.appendMessages.length).toBe(0)
		})
	})

	describe("gate result shape", () => {
		test("never hard-blocks (TL-05 is SHOULD, TL-07 is WARNING)", () => {
			const commit: GitCommitOutput = {
				shortHash: "abc1234",
				message: 'Revert "some feature"',
				branch: "main",
				isRevert: true,
			}
			const result = evaluateCommitGate(commit)
			expect(result.hardBlock).toBeUndefined()
		})
	})
})
