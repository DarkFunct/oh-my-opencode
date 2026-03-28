import { existsSync } from "node:fs"
import { isAbsolute, resolve } from "node:path"
import { readBoulderState } from "../../features/boulder-state"

function normalizeWorktreePath(directory: string, worktreePath: string): string {
  return isAbsolute(worktreePath) ? worktreePath : resolve(directory, worktreePath)
}

export function resolveGovernanceWorkspaceRoot(directory: string): string {
  const boulder = readBoulderState(directory)
  const configuredWorktreePath = boulder?.worktree_path?.trim()
  if (!configuredWorktreePath) {
    return directory
  }

  const resolvedWorktreePath = normalizeWorktreePath(directory, configuredWorktreePath)
  if (!existsSync(resolvedWorktreePath)) {
    return directory
  }

  return resolvedWorktreePath
}
