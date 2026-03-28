import type { GovernanceRuntimeFallbackReason } from "./governance-runtime-fallback-types"

const validatedSessions = new Map<string, { leaseTaskId?: string; validatedAt: number }>()

export interface GovernanceBootGateState {
  status: "passed" | "failed" | "skipped"
  checkedAt: number
  message?: string
  policyVersion?: string
  policyFingerprint?: string
  provider?: string
  modelFamily?: string
}

const bootGateSessions = new Map<string, GovernanceBootGateState>()

export interface GovernanceRuntimeFallbackState {
  reason: GovernanceRuntimeFallbackReason
  source: string
  updatedAt: number
  selectedFallbackModel?: string
  statusCode?: number
  errorName?: string
  errorMessage?: string
}

const runtimeFallbackSessions = new Map<string, GovernanceRuntimeFallbackState>()

export function markGovernanceSessionValidated(sessionID: string, leaseTaskId?: string): void {
  validatedSessions.set(sessionID, {
    leaseTaskId,
    validatedAt: Date.now(),
  })
}

export function isGovernanceSessionValidated(sessionID: string): boolean {
  return validatedSessions.has(sessionID)
}

export function getGovernanceSessionLeaseTaskId(sessionID: string): string | undefined {
  return validatedSessions.get(sessionID)?.leaseTaskId
}

export function clearGovernanceSessionValidation(sessionID: string): void {
  validatedSessions.delete(sessionID)
  bootGateSessions.delete(sessionID)
  runtimeFallbackSessions.delete(sessionID)
}

export function markGovernanceBootGateState(
  sessionID: string,
  state: GovernanceBootGateState,
): void {
  bootGateSessions.set(sessionID, state)
}

export function getGovernanceBootGateState(
  sessionID: string,
): GovernanceBootGateState | undefined {
  return bootGateSessions.get(sessionID)
}

export function getGovernanceBootGateFailureMessage(
  sessionID: string,
): string | undefined {
  const state = bootGateSessions.get(sessionID)
  if (!state || state.status !== "failed") return undefined
  return state.message
}

export function clearGovernanceBootGateState(sessionID: string): void {
  bootGateSessions.delete(sessionID)
}

export function markGovernanceRuntimeFallbackState(
  sessionID: string,
  state: GovernanceRuntimeFallbackState,
): void {
  runtimeFallbackSessions.set(sessionID, state)
}

export function getGovernanceRuntimeFallbackState(
  sessionID: string,
): GovernanceRuntimeFallbackState | undefined {
  return runtimeFallbackSessions.get(sessionID)
}

export function clearGovernanceRuntimeFallbackState(sessionID: string): void {
  runtimeFallbackSessions.delete(sessionID)
}

export function _resetGovernanceSessionValidationForTesting(): void {
  validatedSessions.clear()
  bootGateSessions.clear()
  runtimeFallbackSessions.clear()
}
