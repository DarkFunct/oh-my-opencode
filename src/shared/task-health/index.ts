export { loadIndex, getEntry, upsertEntry, markDetached, flush, flushIfDirty } from "./health-sidecar"
export {
  checkStalePending,
  checkStaleInProgress,
  checkDetachedOrphan,
  checkBurstCreation,
  getAdaptiveMultiplier,
} from "./threshold-policy"
export {
  detectStalePending,
  detectStaleInProgress,
  detectOrphanCandidate,
  detectBurstCreation,
  detectSubagentViolation,
  detectDependencyDeadlock,
  detectTodoDiverged,
  detectBgUnread,
} from "./anomaly-checks"
export type { AnomalyCheckResult } from "./anomaly-checks"
export { scanAllTasks, formatSummary } from "./anomaly-detector"
export type { AnomalyReport, ScanOptions } from "./anomaly-detector"
export type {
  AnomalyType,
  TaskHealthEntry,
  HealthIndex,
  ThresholdSeverity,
  ThresholdConfig,
  ThresholdResult,
  ThresholdMetadata,
} from "./types"
export {
  getParentSessionSummary,
  getGlobalSummary,
  markCollected,
  isCollected,
} from "./background-status-bridge"
export type { BackgroundSessionSummary } from "./background-status-bridge"
