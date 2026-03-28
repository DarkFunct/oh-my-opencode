import { mkdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { writeBoulderState } from "../../features/boulder-state"
import { resolveGovernanceWorkspaceRoot } from "./governance-workspace-root"

describe("resolveGovernanceWorkspaceRoot", () => {
  let directory: string

  beforeEach(() => {
    directory = join(tmpdir(), `governance-workspace-root-${randomUUID()}`)
    mkdirSync(directory, { recursive: true })
  })

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true })
  })

  test("returns project directory when boulder state is missing", () => {
    const result = resolveGovernanceWorkspaceRoot(directory)
    expect(result).toBe(directory)
  })

  test("returns worktree path when boulder worktree exists", () => {
    const worktreePath = join(directory, "worktrees", "feature-a")
    mkdirSync(worktreePath, { recursive: true })
    writeBoulderState(directory, {
      active_plan: join(directory, ".sisyphus", "plans", "p.md"),
      started_at: new Date().toISOString(),
      session_ids: ["ses-1"],
      plan_name: "p",
      worktree_path: worktreePath,
    })

    const result = resolveGovernanceWorkspaceRoot(directory)
    expect(result).toBe(worktreePath)
  })

  test("falls back to project directory when worktree path does not exist", () => {
    writeBoulderState(directory, {
      active_plan: join(directory, ".sisyphus", "plans", "p.md"),
      started_at: new Date().toISOString(),
      session_ids: ["ses-1"],
      plan_name: "p",
      worktree_path: join(directory, "worktrees", "missing"),
    })

    const result = resolveGovernanceWorkspaceRoot(directory)
    expect(result).toBe(directory)
  })
})
