import type { TaskObject } from "./types"
import type { AnomalyCheckResult } from "../../shared/task-health/anomaly-checks"

const ORPHAN_RATIO_THRESHOLD_PER_THOUSAND = 0.5
const TODO_SYNC_VISIBILITY_SLA_MS = 5_000
const TODO_SYNC_WINDOW_MS = 24 * 60 * 60 * 1000

export interface P1DodStatus {
  noBreakerCollateralized: boolean
  breakerIncidentCount: number
  deadlockDetectionMs: number
  deadlockSlaTargetMs: number
  deadlockWithinSla: boolean
  orphanCandidateCount: number
  orphanRatioPerThousand: number
  orphanThresholdPerThousand: number
  orphanWithinDod: boolean
  todoSync: {
    failureCount24h: number
    visibleWithinSlaCount24h: number
    silentOrLateFailureCount24h: number
    visibilitySlaMs: number
    silentFailureZero: boolean
  }
}

interface P1DodInput {
  anomalies: AnomalyCheckResult[]
  allTasks: TaskObject[]
  activeTaskCount: number
  deadlockDetectionMs: number
  deadlockSlaTargetMs: number
  deadlockWithinSla: boolean
  nowMs?: number
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function countTodoSyncFailures(tasks: TaskObject[], nowMs: number): P1DodStatus["todoSync"] {
  const cutoff = nowMs - TODO_SYNC_WINDOW_MS
  let failureCount24h = 0
  let visibleWithinSlaCount24h = 0

  for (const task of tasks) {
    const failureAt = task.metadata?.todoSyncLastFailureAtMs
    if (typeof failureAt !== "number" || failureAt < cutoff) {
      continue
    }

    failureCount24h++
    const visibleWithinMs = task.metadata?.todoSyncLastFailureVisibleWithinMs
    if (typeof visibleWithinMs === "number" && visibleWithinMs <= TODO_SYNC_VISIBILITY_SLA_MS) {
      visibleWithinSlaCount24h++
    }
  }

  const silentOrLateFailureCount24h = Math.max(0, failureCount24h - visibleWithinSlaCount24h)

  return {
    failureCount24h,
    visibleWithinSlaCount24h,
    silentOrLateFailureCount24h,
    visibilitySlaMs: TODO_SYNC_VISIBILITY_SLA_MS,
    silentFailureZero: silentOrLateFailureCount24h === 0,
  }
}

export function buildP1DodStatus(input: P1DodInput): P1DodStatus {
  const nowMs = input.nowMs ?? Date.now()
  const orphanCandidateCount = input.anomalies.filter((anomaly) => anomaly.type === "orphan_candidate").length
  const breakerIncidentCount = input.anomalies.filter((anomaly) => /breaker/i.test(anomaly.message)).length

  const orphanRatioPerThousand =
    input.activeTaskCount > 0
      ? roundTo((orphanCandidateCount / input.activeTaskCount) * 1000, 3)
      : 0

  return {
    noBreakerCollateralized: breakerIncidentCount === 0,
    breakerIncidentCount,
    deadlockDetectionMs: input.deadlockDetectionMs,
    deadlockSlaTargetMs: input.deadlockSlaTargetMs,
    deadlockWithinSla: input.deadlockWithinSla,
    orphanCandidateCount,
    orphanRatioPerThousand,
    orphanThresholdPerThousand: ORPHAN_RATIO_THRESHOLD_PER_THOUSAND,
    orphanWithinDod: orphanRatioPerThousand < ORPHAN_RATIO_THRESHOLD_PER_THOUSAND,
    todoSync: countTodoSyncFailures(input.allTasks, nowMs),
  }
}
