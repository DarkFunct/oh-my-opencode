import type { AnomalyCheckResult } from "../../shared/task-health/anomaly-checks"
import type { AnomalyType } from "../../shared/task-health/types"

export interface RecommendedAction {
  priority: "p1" | "p2" | "p3"
  action: string
  reason: string
}

export interface GovernanceOverview {
  riskLevel: "healthy" | "degraded" | "critical"
  actionCounts: {
    p1: number
    p2: number
    p3: number
  }
  anomalyTypeCounts: Partial<Record<AnomalyType, number>>
  primarySignals: string[]
}

const PRIORITY_RANK: Record<RecommendedAction["priority"], number> = {
  p1: 1,
  p2: 2,
  p3: 3,
}

export function buildRecommendedActions(anomalies: AnomalyCheckResult[], cycleDetected: boolean): string[] {
  const actionSet = new Set<string>()
  const anomalyTypes = new Set(anomalies.map((anomaly) => anomaly.type))

  if (cycleDetected) {
    actionSet.add("Resolve dependency cycle in blockedBy graph before starting new task execution")
  }
  if (anomalyTypes.has("orphan_candidate")) {
    actionSet.add("Run task_reconcile with operation=clean_orphans (dry_run first) and inspect detached sessions")
  }
  if (anomalyTypes.has("ownership_drift")) {
    actionSet.add("Resolve owner/session drift and ensure only claimed owner session performs task updates")
  }
  if (anomalyTypes.has("stale_pending") || anomalyTypes.has("stale_in_progress")) {
    actionSet.add("Review stale tasks and either progress, reassign owner, or mark as deleted")
  }
  if (anomalyTypes.has("todo_diverged")) {
    actionSet.add("Investigate todo-sync path and verify task/todo status convergence")
  }

  if (actionSet.size === 0) {
    actionSet.add("No immediate corrective action")
  }

  return [...actionSet]
}

export function buildActionPlan(anomalies: AnomalyCheckResult[], cycleDetected: boolean): RecommendedAction[] {
  const anomalyTypes = new Set(anomalies.map((anomaly) => anomaly.type))
  const candidates: RecommendedAction[] = []

  if (cycleDetected || anomalyTypes.has("dependency_deadlock")) {
    candidates.push({
      priority: "p1",
      action: "Break dependency cycle in blockedBy graph before any new task starts",
      reason: "dependency_deadlock",
    })
  }
  if (anomalyTypes.has("orphan_candidate")) {
    candidates.push({
      priority: "p1",
      action: "Run task_reconcile clean_orphans (dry_run first) and reattach/close detached tasks",
      reason: "orphan_candidate",
    })
  }
  if (anomalyTypes.has("ownership_drift")) {
    candidates.push({
      priority: "p1",
      action: "Fix owner/session drift and keep task updates on the claimed owner session",
      reason: "ownership_drift",
    })
  }
  if (anomalyTypes.has("stale_pending") || anomalyTypes.has("stale_in_progress")) {
    candidates.push({
      priority: "p2",
      action: "Reevaluate stale tasks and either progress, reassign owner, or close",
      reason: anomalyTypes.has("stale_in_progress") ? "stale_in_progress" : "stale_pending",
    })
  }
  if (anomalyTypes.has("todo_diverged")) {
    candidates.push({
      priority: "p3",
      action: "Investigate todo-sync divergence and re-sync task/todo states",
      reason: "todo_diverged",
    })
  }

  if (candidates.length === 0) {
    return [{
      priority: "p3",
      action: "No immediate corrective action",
      reason: "healthy",
    }]
  }

  const byReason = new Map<string, RecommendedAction>()
  for (const candidate of candidates) {
    const existing = byReason.get(candidate.reason)
    if (!existing || PRIORITY_RANK[candidate.priority] < PRIORITY_RANK[existing.priority]) {
      byReason.set(candidate.reason, candidate)
    }
  }

  return [...byReason.values()].sort((a, b) => {
    const rankDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    return rankDiff !== 0 ? rankDiff : a.reason.localeCompare(b.reason)
  })
}

function countAnomalyTypes(anomalies: AnomalyCheckResult[]): Partial<Record<AnomalyType, number>> {
  const counts: Partial<Record<AnomalyType, number>> = {}
  for (const anomaly of anomalies) {
    counts[anomaly.type] = (counts[anomaly.type] ?? 0) + 1
  }
  return counts
}

export function buildGovernanceOverview(
  anomalies: AnomalyCheckResult[],
  actionPlan: RecommendedAction[],
  deadlockWithinSla: boolean,
): GovernanceOverview {
  const actionCounts = {
    p1: actionPlan.filter((item) => item.priority === "p1").length,
    p2: actionPlan.filter((item) => item.priority === "p2").length,
    p3: actionPlan.filter((item) => item.priority === "p3").length,
  }

  let riskLevel: GovernanceOverview["riskLevel"] = "healthy"
  if (!deadlockWithinSla || actionCounts.p1 > 0) {
    riskLevel = "critical"
  } else if (anomalies.length > 0 || actionCounts.p2 > 0) {
    riskLevel = "degraded"
  }

  const primarySignals = actionPlan
    .filter((item) => item.priority !== "p3" || item.reason !== "healthy")
    .slice(0, 3)
    .map((item) => item.reason)

  return {
    riskLevel,
    actionCounts,
    anomalyTypeCounts: countAnomalyTypes(anomalies),
    primarySignals,
  }
}
