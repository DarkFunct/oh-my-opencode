import { describe, expect, test } from "bun:test"
import type { TaskObject } from "./types"
import type { AnomalyCheckResult } from "../../shared/task-health/anomaly-checks"
import { buildP1DodStatus } from "./task-health-p1-dod"

function task(overrides: Partial<TaskObject>): TaskObject {
  return {
    id: "T-1",
    subject: "task",
    description: "",
    status: "pending",
    blocks: [],
    blockedBy: [],
    threadID: "ses-1",
    ...overrides,
  }
}

function anomaly(overrides: Partial<AnomalyCheckResult>): AnomalyCheckResult {
  return {
    type: "stale_pending",
    taskId: "T-1",
    severity: "warning",
    message: "anomaly",
    ...overrides,
  }
}

describe("task-health-p1-dod", () => {
  test("returns healthy p1 DoD snapshot with no anomalies", () => {
    const now = 1_770_000_000_000
    const result = buildP1DodStatus({
      anomalies: [],
      allTasks: [task({})],
      activeTaskCount: 1,
      deadlockDetectionMs: 12,
      deadlockSlaTargetMs: 10_000,
      deadlockWithinSla: true,
      nowMs: now,
    })

    expect(result.noBreakerCollateralized).toBe(true)
    expect(result.breakerIncidentCount).toBe(0)
    expect(result.orphanCandidateCount).toBe(0)
    expect(result.orphanRatioPerThousand).toBe(0)
    expect(result.orphanWithinDod).toBe(true)
    expect(result.todoSync.failureCount24h).toBe(0)
    expect(result.todoSync.silentFailureZero).toBe(true)
  })

  test("marks orphan ratio and todo visibility failures correctly", () => {
    const now = 1_770_000_000_000
    const recent = now - 1_000
    const old = now - 2 * 24 * 60 * 60 * 1000
    const result = buildP1DodStatus({
      anomalies: [
        anomaly({ type: "orphan_candidate" }),
        anomaly({ type: "orphan_candidate", taskId: "T-2" }),
        anomaly({ type: "stale_pending", message: "breaker tripped" }),
      ],
      allTasks: [
        task({
          id: "T-fail-fast",
          metadata: {
            todoSyncLastFailureAtMs: recent,
            todoSyncLastFailureVisibleWithinMs: 1000,
          },
        }),
        task({
          id: "T-fail-late",
          metadata: {
            todoSyncLastFailureAtMs: recent,
            todoSyncLastFailureVisibleWithinMs: 7000,
          },
        }),
        task({
          id: "T-fail-old",
          metadata: {
            todoSyncLastFailureAtMs: old,
            todoSyncLastFailureVisibleWithinMs: 1000,
          },
        }),
      ],
      activeTaskCount: 2,
      deadlockDetectionMs: 99,
      deadlockSlaTargetMs: 10_000,
      deadlockWithinSla: true,
      nowMs: now,
    })

    expect(result.breakerIncidentCount).toBe(1)
    expect(result.noBreakerCollateralized).toBe(false)
    expect(result.orphanCandidateCount).toBe(2)
    expect(result.orphanRatioPerThousand).toBe(1000)
    expect(result.orphanWithinDod).toBe(false)
    expect(result.todoSync.failureCount24h).toBe(2)
    expect(result.todoSync.visibleWithinSlaCount24h).toBe(1)
    expect(result.todoSync.silentOrLateFailureCount24h).toBe(1)
    expect(result.todoSync.silentFailureZero).toBe(false)
  })
})
