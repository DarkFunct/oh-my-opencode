import { describe, expect, test } from "bun:test"
import type { TaskObject } from "./types"
import { buildProgressOverview } from "./task-health-progress"

function task(overrides: Partial<TaskObject>): TaskObject {
  return {
    id: "T-x",
    subject: "task",
    description: "",
    status: "pending",
    blocks: [],
    blockedBy: [],
    threadID: "ses-1",
    ...overrides,
  }
}

describe("task-health-progress", () => {
  test("computes 24h progress window and metadata coverage", () => {
    const now = 1_770_000_000_000
    const withinWindow = now - 60_000
    const outsideWindow = now - (48 * 60 * 60 * 1000)

    const tasks: TaskObject[] = [
      task({
        id: "T-1",
        metadata: {
          createdAtMs: withinWindow,
          lastStatusChangeAtMs: withinWindow,
          ownerSessionID: "ses-1",
        },
      }),
      task({
        id: "T-2",
        status: "completed",
        metadata: {
          createdAtMs: withinWindow,
          completedAtMs: withinWindow,
          lastStatusChangeAtMs: withinWindow,
          ownerSessionID: "ses-2",
        },
      }),
      task({
        id: "T-3",
        status: "completed",
        metadata: {
          createdAtMs: outsideWindow,
          completedAtMs: outsideWindow,
          lastStatusChangeAtMs: outsideWindow,
        },
      }),
    ]

    const overview = buildProgressOverview(tasks, now)

    expect(overview.windowHours).toBe(24)
    expect(overview.createdInWindow).toBe(2)
    expect(overview.completedInWindow).toBe(1)
    expect(overview.statusTransitionsInWindow).toBe(2)
    expect(overview.completionVelocityPerHour).toBeCloseTo(0.042, 3)
    expect(overview.completionRate).toBe(0.5)
    expect(overview.metadataCoverage).toEqual({
      createdAtMs: 3,
      completedAtMs: 2,
      lastStatusChangeAtMs: 3,
      ownerSessionID: 2,
    })
  })
})
