import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { join } from "path"
import { existsSync, rmSync } from "fs"
import type { TaskObject } from "./types"
import { createTaskList } from "./task-list"
import { writeJsonAtomic } from "../../features/claude-tasks/storage"

const testProjectDir = "/tmp/task-list-dispatch-test"

function createConfig() {
  return {
    sisyphus: {
      tasks: {
        storage_path: join(testProjectDir, ".sisyphus/tasks"),
        claude_code_compat: false,
      },
    },
  }
}

function writeTask(task: TaskObject): void {
  writeJsonAtomic(join(testProjectDir, ".sisyphus/tasks", `${task.id}.json`), task)
}

describe("task_list dispatch summary", () => {
  let taskDir: string

  beforeEach(() => {
    taskDir = join(testProjectDir, ".sisyphus/tasks")
    if (existsSync(taskDir)) {
      rmSync(taskDir, { recursive: true })
    }
  })

  afterEach(() => {
    if (existsSync(taskDir)) {
      rmSync(taskDir, { recursive: true })
    }
  })

  it("returns ready task ids and edge count", async () => {
    writeTask({
      id: "T-a",
      subject: "task a",
      description: "",
      status: "pending",
      blocks: [],
      blockedBy: [],
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

    const result = await createTaskList(createConfig()).execute({}, { sessionID: "ses-1" })
    const parsed = JSON.parse(result)

    expect(parsed.dispatch.nodeCount).toBe(2)
    expect(parsed.dispatch.edgeCount).toBe(1)
    expect(parsed.dispatch.readyTaskIds).toEqual(["T-a"])
    expect(parsed.dispatch.cycleDetected).toBe(false)
  })

  it("detects simple dependency cycle", async () => {
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

    const result = await createTaskList(createConfig()).execute({}, { sessionID: "ses-1" })
    const parsed = JSON.parse(result)

    expect(parsed.dispatch.cycleDetected).toBe(true)
    expect(parsed.dispatch.cycleTaskIds.sort()).toEqual(["T-a", "T-b"])
  })
})
