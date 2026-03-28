import type { AnomalyReport } from "../../shared/task-health/anomaly-detector"

export function buildHealthSummaryTag(report: AnomalyReport): string {
  if (report.anomalies.length === 0 && report.scannedCount === 0) return ""

  const bySeverity = { critical: 0, error: 0, warning: 0, info: 0 }
  const byType = new Map<string, number>()
  let staleCount = 0
  let orphanCount = 0

  for (const a of report.anomalies) {
    bySeverity[a.severity] += 1
    byType.set(a.type, (byType.get(a.type) ?? 0) + 1)
    if (a.type === "stale_pending" || a.type === "stale_in_progress") staleCount += 1
    if (a.type === "orphan_candidate") orphanCount += 1
  }

  const parts: string[] = [
    `tasks: ${report.scannedCount} active / ${staleCount} stale / ${orphanCount} orphan`,
  ]

  if (bySeverity.critical > 0) {
    const criticalAnomalies = report.anomalies
      .filter((a) => a.severity === "critical")
      .map((a) => a.message)
      .slice(0, 3)
    parts.push(`⚠️ CRITICAL: ${criticalAnomalies.join("; ")}`)
  }

  return `<task-health>\n${parts.join("\n")}\n</task-health>`
}

export function buildCompactionSnapshot(report: AnomalyReport): string {
  const lines: string[] = ["[task-health compaction snapshot]"]
  lines.push(`scanned: ${report.scannedCount} tasks`)
  lines.push(`anomalies: ${report.anomalies.length}`)

  if (report.anomalies.length > 0) {
    lines.push("active anomalies:")
    for (const a of report.anomalies.slice(0, 10)) {
      lines.push(`  - [${a.severity}] ${a.type}: ${a.message}`)
    }
  }

  return lines.join("\n")
}
