import type { TaskHealthEntry, ThresholdConfig, ThresholdMetadata, ThresholdResult } from "./types"

const MINUTE_MS = 60_000
const BASE_EXPECTED_DURATION_MS = 60 * MINUTE_MS
const MAX_ADAPTIVE_MULTIPLIER = 4

const PENDING_THRESHOLDS: ThresholdConfig = {
  softMs: 30 * MINUTE_MS,
  hardMs: 4 * 60 * MINUTE_MS,
}

const IN_PROGRESS_THRESHOLDS: ThresholdConfig = {
  softMs: 20 * MINUTE_MS,
  hardMs: 90 * MINUTE_MS,
}

const DETACHED_THRESHOLDS: ThresholdConfig = {
  softMs: 0,
  hardMs: 15 * MINUTE_MS,
}

function clampMultiplier(value: number): number {
  if (value < 1) return 1
  if (value > MAX_ADAPTIVE_MULTIPLIER) return MAX_ADAPTIVE_MULTIPLIER
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function normalizeMetadata(
  metadata?: ThresholdMetadata | Record<string, unknown>,
): ThresholdMetadata | undefined {
  if (!metadata || !isRecord(metadata)) return undefined

  const expectedDurationValue = metadata.expectedDurationMs
  const longRunningValue = metadata.longRunning

  const expectedDurationMs =
    typeof expectedDurationValue === "number" && expectedDurationValue > 0
      ? expectedDurationValue
      : undefined
  const longRunning = typeof longRunningValue === "boolean" ? longRunningValue : undefined

  if (expectedDurationMs === undefined && longRunning === undefined) {
    return undefined
  }

  return {
    expectedDurationMs,
    longRunning,
  }
}

function withAdaptiveThreshold(
  config: ThresholdConfig,
  metadata?: ThresholdMetadata | Record<string, unknown>,
): ThresholdConfig {
  const multiplier = getAdaptiveMultiplier(metadata)
  return {
    softMs: Math.round(config.softMs * multiplier),
    hardMs: Math.round(config.hardMs * multiplier),
  }
}

function evaluateElapsed(elapsedMs: number, config: ThresholdConfig): ThresholdResult {
  if (elapsedMs >= config.hardMs) {
    return {
      exceeded: true,
      severity: "hard",
      elapsedMs,
      thresholdMs: config.hardMs,
    }
  }

  if (elapsedMs >= config.softMs) {
    return {
      exceeded: true,
      severity: "soft",
      elapsedMs,
      thresholdMs: config.softMs,
    }
  }

  return {
    exceeded: false,
    severity: null,
    elapsedMs,
    thresholdMs: config.softMs,
  }
}

export function getAdaptiveMultiplier(metadata?: ThresholdMetadata | Record<string, unknown>): number {
  const normalized = normalizeMetadata(metadata)
  if (!normalized) return 1

  let multiplier = 1

  if (normalized.longRunning) {
    multiplier = Math.max(multiplier, 2)
  }

  if (typeof normalized.expectedDurationMs === "number" && normalized.expectedDurationMs > 0) {
    multiplier = Math.max(multiplier, normalized.expectedDurationMs / BASE_EXPECTED_DURATION_MS)
  }

  return clampMultiplier(multiplier)
}

export function checkStalePending(
  entry: TaskHealthEntry,
  now: number = Date.now(),
  metadata?: ThresholdMetadata | Record<string, unknown>,
): ThresholdResult {
  const thresholds = withAdaptiveThreshold(PENDING_THRESHOLDS, metadata)
  const elapsedMs = Math.max(0, now - entry.createdAt)
  return evaluateElapsed(elapsedMs, thresholds)
}

export function checkStaleInProgress(
  entry: TaskHealthEntry,
  now: number = Date.now(),
  metadata?: ThresholdMetadata | Record<string, unknown>,
): ThresholdResult {
  const thresholds = withAdaptiveThreshold(IN_PROGRESS_THRESHOLDS, metadata)
  const elapsedMs = Math.max(0, now - entry.lastTaskToolAt)
  return evaluateElapsed(elapsedMs, thresholds)
}

export function checkDetachedOrphan(
  entry: TaskHealthEntry,
  now: number = Date.now(),
  metadata?: ThresholdMetadata | Record<string, unknown>,
): ThresholdResult {
  const thresholds = withAdaptiveThreshold(DETACHED_THRESHOLDS, metadata)

  if (entry.detachedAt === undefined) {
    return {
      exceeded: false,
      severity: null,
      elapsedMs: 0,
      thresholdMs: thresholds.softMs,
    }
  }

  const elapsedMs = Math.max(0, now - entry.detachedAt)
  return evaluateElapsed(elapsedMs, thresholds)
}

export function checkBurstCreation(
  recentCreationTimestamps: number[],
  isRootScope: boolean = false,
  metadata?: ThresholdMetadata | Record<string, unknown>,
): ThresholdResult {
  const now = Date.now()
  const windowMs = isRootScope ? 10 * MINUTE_MS : 2 * MINUTE_MS
  const baseSoft = isRootScope ? 20 : 5
  const baseHard = isRootScope ? 50 : 10
  const multiplier = getAdaptiveMultiplier(metadata)

  const softThreshold = Math.ceil(baseSoft * multiplier)
  const hardThreshold = Math.ceil(baseHard * multiplier)
  const recentCount = recentCreationTimestamps.filter((ts) => now - ts <= windowMs).length

  if (recentCount > hardThreshold) {
    return {
      exceeded: true,
      severity: "hard",
      elapsedMs: recentCount,
      thresholdMs: hardThreshold,
    }
  }

  if (recentCount > softThreshold) {
    return {
      exceeded: true,
      severity: "soft",
      elapsedMs: recentCount,
      thresholdMs: softThreshold,
    }
  }

  return {
    exceeded: false,
    severity: null,
    elapsedMs: recentCount,
    thresholdMs: softThreshold,
  }
}
