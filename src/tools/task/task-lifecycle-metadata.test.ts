import type { TaskObject } from "./types"
import {
  applyStatusTransitionMetadata,
  claimOwnershipIfMissing,
  readOwnerSessionID,
} from "./task-lifecycle-metadata"

function createTask(): TaskObject {
  return {
    id: "T-meta-1",
    subject: "Task",
    description: "",
    status: "pending",
    blocks: [],
    blockedBy: [],
    threadID: "ses-1",
  }
}

describe("task-lifecycle-metadata", () => {
  test("claims ownership when missing", () => {
    const task = createTask()
    claimOwnershipIfMissing(task, "ses-owner", 1000)

    expect(readOwnerSessionID(task)).toBe("ses-owner")
    expect(task.metadata?.ownerClaimedAtMs).toBe(1000)
  })

  test("does not override existing ownership", () => {
    const task = createTask()
    task.metadata = { ownerSessionID: "ses-existing", ownerClaimedAtMs: 500 }

    claimOwnershipIfMissing(task, "ses-owner", 1000)

    expect(readOwnerSessionID(task)).toBe("ses-existing")
    expect(task.metadata?.ownerClaimedAtMs).toBe(500)
  })

  test("writes completion timestamps on completed transition", () => {
    const task = createTask()
    task.status = "completed"

    applyStatusTransitionMetadata(task, "in_progress", "completed", 1234)

    expect(task.metadata?.lastStatusChangeAtMs).toBe(1234)
    expect(task.metadata?.completedAtMs).toBe(1234)
  })

  test("clears completedAtMs when leaving completed status", () => {
    const task = createTask()
    task.metadata = { completedAtMs: 111, lastStatusChangeAtMs: 111 }

    applyStatusTransitionMetadata(task, "completed", "in_progress", 222)

    expect(task.metadata?.lastStatusChangeAtMs).toBe(222)
    expect(task.metadata?.completedAtMs).toBeUndefined()
  })
})
