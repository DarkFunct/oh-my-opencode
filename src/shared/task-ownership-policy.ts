/**
 * Task Ownership Policy — Subagent Task Gate
 *
 * Prevents subagent sessions from creating/modifying persistent tasks.
 * Root cause fix for orphan task explosion (P-018).
 *
 * Reuses the existing `subagentSessions` Set from claude-code-session-state.
 */

import { subagentSessions } from "../features/claude-code-session-state"

export function isSubagentSession(sessionID: string): boolean {
  return subagentSessions.has(sessionID)
}

export function canCreatePersistentTask(sessionID: string): boolean {
  return !isSubagentSession(sessionID)
}
