import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { existsSync, rmSync } from "fs"
import { join } from "path"
import type { TaskObject } from "./types"
import { writeJsonAtomic } from "../../features/claude-tasks/storage"
import { createTaskHealthTool } from "./task-health-tool"

const testProjectDir = "/tmp/task-health-tool-test"
const testTaskDir = join(testProjectDir, ".sisyphus/tasks")

function createConfig() {
  return {
    sisyphus: {
      tasks: {
        storage_path: testTaskDir,
        claude_code_compat: false,
      },
    },
  }
}

function writeTask(task: TaskObject): void {
  writeJsonAtomic(join(testTaskDir, `${task.id}.json`), task)
}

describe("task_health tool", () => {
  beforeEach(() => {
    if (existsSync(testTaskDir)) {
      rmSync(testTaskDir, { recursive: true, force: true })
    }
  })

  afterEach(() => {
    if (existsSync(testTaskDir)) {
      rmSync(testTaskDir, { recursive: true, force: true })
    }
  })

  test("returns dispatch summary for healthy graph", async () => {
    writeTask({
      id: "T-1",
      subject: "ready task",
      description: "",
      status: "pending",
      blocks: [],
      blockedBy: [],
      threadID: "ses-1",
    })
    writeTask({
      id: "T-2",
      subject: "blocked task",
      description: "",
      status: "pending",
      blocks: [],
      blockedBy: ["T-1"],
      threadID: "ses-1",
    })

    const result = await createTaskHealthTool(createConfig()).execute({}, { sessionID: "ses-1" })
    const parsed = JSON.parse(result)

    expect(parsed.activeTasks).toBe(2)
    expect(parsed.dispatch.nodeCount).toBe(2)
    expect(parsed.dispatch.edgeCount).toBe(1)
    expect(parsed.dispatch.cycleDetected).toBe(false)
    expect(parsed.dispatch.readyTaskIds).toEqual(["T-1"])
    expect(parsed.deadlockWithinSla).toBe(true)
    expect(parsed.deadlockSlaTargetMs).toBe(10000)
    expect(Array.isArray(parsed.recommendedActions)).toBe(true)
    expect(Array.isArray(parsed.actionPlan)).toBe(true)
    expect(parsed.actionPlan[0].priority).toBe("p3")
    expect(parsed.actionPlan[0].reason).toBe("healthy")
    expect(parsed.governanceOverview.riskLevel).toBe("healthy")
    expect(parsed.governanceOverview.actionCounts.p1).toBe(0)
    expect(parsed.progressOverview.windowHours).toBe(24)
    expect(typeof parsed.progressOverview.generatedAtMs).toBe("number")
    expect(parsed.p1DodStatus.noBreakerCollateralized).toBe(true)
    expect(parsed.p1DodStatus.orphanWithinDod).toBe(true)
    expect(parsed.p1DodStatus.todoSync.silentFailureZero).toBe(true)
  })

  test("reports cycle and recommended action when dependency deadlock exists", async () => {
    writeTask({
      id: "T-a",
      subject: "task a",
      description: "",
      status: "pending",
      blocks: [],
      blockedBy: ["T-b"],
      threadID: "ses-1",
    })
    writeTask({
      id: "T-b",
      subject: "task b",
      description: "",
      status: "pending",
      blocks: [],
      blockedBy: ["T-a"],
      threadID: "ses-1",
    })

    const result = await createTaskHealthTool(createConfig()).execute({}, { sessionID: "ses-1" })
    const parsed = JSON.parse(result)

    expect(parsed.dispatch.cycleDetected).toBe(true)
    expect(parsed.dispatch.cycleTaskIds.sort()).toEqual(["T-a", "T-b"])
    expect(parsed.anomalyCount).toBeGreaterThan(0)
    expect(parsed.recommendedActions.some((action: string) => action.includes("dependency cycle"))).toBe(true)
    expect(parsed.actionPlan.some((item: { priority: string; reason: string }) => item.priority === "p1" && item.reason === "dependency_deadlock")).toBe(true)
    expect(parsed.governanceOverview.riskLevel).toBe("critical")
    expect(parsed.governanceOverview.primarySignals).toContain("dependency_deadlock")
  })

  test("reports ownership drift in anomaly details and action plan", async () => {
    writeTask({
      id: "T-ownership",
      subject: "ownership drift",
      description: "",
      status: "pending",
      blocks: [],
      blockedBy: [],
      threadID: "ses-creator",
      metadata: {
        ownerSessionID: "ses-claimed",
      },
    })

    const result = await createTaskHealthTool(createConfig()).execute({}, { sessionID: "ses-creator" })
    const parsed = JSON.parse(result)

    expect(parsed.anomalyDetails.some((item: { type: string }) => item.type === "ownership_drift")).toBe(true)
    expect(parsed.actionPlan.some((item: { reason: string; priority: string }) => item.reason === "ownership_drift" && item.priority === "p1")).toBe(true)
    expect(parsed.governanceOverview.riskLevel).toBe("critical")
    expect(parsed.governanceOverview.anomalyTypeCounts.ownership_drift).toBe(1)
  })
})
