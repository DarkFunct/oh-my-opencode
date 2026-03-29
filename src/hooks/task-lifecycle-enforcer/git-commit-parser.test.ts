import { describe, expect, test } from "bun:test"
import { parseGitCommitOutput } from "./git-commit-parser"

describe("parseGitCommitOutput", () => {
	test("parses standard git commit output", () => {
		const output = `[main abc1234] feat: add new feature
 3 files changed, 10 insertions(+), 5 deletions(-)`
		const result = parseGitCommitOutput(output)
		expect(result).toEqual({
			shortHash: "abc1234",
			message: "feat: add new feature",
			branch: "main",
			isRevert: false,
		})
	})

	test("parses commit on feature branch", () => {
		const output = `[feature/task-lifecycle 381a619] M3-VCS: VCS commit auto-association
 16 files changed, 468 insertions(+), 11 deletions(-)
 create mode 100644 packages/kgs-middleware/src/task/commit-association.ts`
		const result = parseGitCommitOutput(output)
		expect(result).toEqual({
			shortHash: "381a619",
			message: "M3-VCS: VCS commit auto-association",
			branch: "feature/task-lifecycle",
			isRevert: false,
		})
	})

	test("parses root commit", () => {
		const output = `[main (root-commit) a1b2c3d] initial commit
 1 file changed, 1 insertion(+)`
		const result = parseGitCommitOutput(output)
		expect(result).toEqual({
			shortHash: "a1b2c3d",
			message: "initial commit",
			branch: "main",
			isRevert: false,
		})
	})

	test("detects revert commit", () => {
		const output = `[main def4567] Revert "feat: add broken feature"
 2 files changed, 5 deletions(-)`
		const result = parseGitCommitOutput(output)
		expect(result).not.toBeNull()
		expect(result!.isRevert).toBe(true)
		expect(result!.message).toBe('Revert "feat: add broken feature"')
	})

	test("detects revert with case insensitivity", () => {
		const output = `[main abc1234] revert "some commit"
 1 file changed`
		const result = parseGitCommitOutput(output)
		expect(result).not.toBeNull()
		expect(result!.isRevert).toBe(true)
	})

	test("returns null for non-commit output", () => {
		expect(parseGitCommitOutput("")).toBeNull()
		expect(parseGitCommitOutput("On branch main")).toBeNull()
		expect(parseGitCommitOutput("nothing to commit, working tree clean")).toBeNull()
	})

	test("returns null for git status or diff output", () => {
		const gitStatus = ` M src/index.ts
?? new-file.ts`
		expect(parseGitCommitOutput(gitStatus)).toBeNull()
	})

	test("parses commit with task reference in message", () => {
		const output = `[main abc1234] [T-550e8400-e29b-41d4-a716-446655440000] fix: resolve auth bug
 1 file changed, 5 insertions(+), 2 deletions(-)`
		const result = parseGitCommitOutput(output)
		expect(result).not.toBeNull()
		expect(result!.message).toBe("[T-550e8400-e29b-41d4-a716-446655440000] fix: resolve auth bug")
		expect(result!.isRevert).toBe(false)
	})

	test("handles multi-line output with env variable noise before commit", () => {
		const output = `export CI=true
[main abc1234] feat: something
 1 file changed`
		const result = parseGitCommitOutput(output)
		expect(result).not.toBeNull()
		expect(result!.shortHash).toBe("abc1234")
	})

	test("handles 12-char short hash", () => {
		const output = `[main abcdef123456] fix: something
 1 file changed`
		const result = parseGitCommitOutput(output)
		expect(result).not.toBeNull()
		expect(result!.shortHash).toBe("abcdef123456")
	})

	test("non-revert message starting with 'Revert' but no quote", () => {
		const output = `[main abc1234] Reverting changes manually
 1 file changed`
		const result = parseGitCommitOutput(output)
		expect(result).not.toBeNull()
		expect(result!.isRevert).toBe(false)
	})
})
