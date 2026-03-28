import { describe, expect, test } from "bun:test"
import type { AnomalyCheckResult } from "../../shared/task-health/anomaly-checks"
import {
  buildActionPlan,
  buildGovernanceOverview,
  buildRecommendedActions,
} from "./task-health-action-plan"

function anomaly(type: AnomalyCheckResult["type"]): AnomalyCheckResult {
  return {
    type,
    taskId: "T-1",
    severity: "warning",
    message: type,
  }
}

describe("task-health-action-plan", () => {
  test("deduplicates/sorts action plan and prioritizes highest severity", () => {
    const anomalies: AnomalyCheckResult[] = [
      anomaly("dependency_deadlock"),
      anomaly("stale_pending"),
      anomaly("stale_in_progress"),
      anomaly("ownership_drift"),
      anomaly("todo_diverged"),
    ]

    const plan = buildActionPlan(anomalies, true)

    expect(plan.map((item) => item.reason)).toEqual([
      "dependency_deadlock",
      "ownership_drift",
      "stale_in_progress",
      "todo_diverged",
    ])
    expect(plan.map((item) => item.priority)).toEqual(["p1", "p1", "p2", "p3"])
  })

  test("returns healthy fallback plan and overview", () => {
    const plan = buildActionPlan([], false)
    const overview = buildGovernanceOverview([], plan, true)

    expect(plan).toEqual([
      {
        priority: "p3",
        action: "No immediate corrective action",
        reason: "healthy",
      },
    ])
    expect(overview.riskLevel).toBe("healthy")
    expect(overview.actionCounts).toEqual({ p1: 0, p2: 0, p3: 1 })
    expect(overview.primarySignals).toEqual([])
  })

  test("marks degraded when only p2 action exists", () => {
    const anomalies: AnomalyCheckResult[] = [anomaly("stale_pending")]
    const plan = buildActionPlan(anomalies, false)
    const overview = buildGovernanceOverview(anomalies, plan, true)

    expect(plan).toEqual([
      {
        priority: "p2",
        action: "Reevaluate stale tasks and either progress, reassign owner, or close",
        reason: "stale_pending",
      },
    ])
    expect(overview.riskLevel).toBe("degraded")
    expect(overview.actionCounts).toEqual({ p1: 0, p2: 1, p3: 0 })
    expect(overview.primarySignals).toEqual(["stale_pending"])
  })

  test("marks critical when deadlock detection breaches SLA", () => {
    const plan = buildActionPlan([], false)
    const overview = buildGovernanceOverview([], plan, false)

    expect(overview.riskLevel).toBe("critical")
    expect(overview.actionCounts).toEqual({ p1: 0, p2: 0, p3: 1 })
  })

  test("recommended actions remains backward-compatible string list", () => {
    const actions = buildRecommendedActions([
      anomaly("orphan_candidate"),
      anomaly("ownership_drift"),
    ], false)

    expect(actions.some((item) => item.includes("clean_orphans"))).toBe(true)
    expect(actions.some((item) => item.includes("owner/session drift"))).toBe(true)
  })
})
