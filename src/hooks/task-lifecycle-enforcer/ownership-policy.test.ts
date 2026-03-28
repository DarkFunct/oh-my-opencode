/// <reference types="bun-types/test-globals" />

import type { PluginInput } from "@opencode-ai/plugin"
import { createTaskLifecycleEnforcerHook } from "./index"
import { deleteSession, getSessionState } from "./state"
import { subagentSessions } from "../../features/claude-code-session-state"

const touchedSessionIDs = new Set<string>()

function trackSessionID(sessionID: string): string {
  touchedSessionIDs.add(sessionID)
  return sessionID
}

function snapshotState(sessionID: string): {
  hasCreatedTask: boolean
  editWriteCallCount: number
  taskCompletedCount: number
  lastReminderTime: number
  activeTaskIds: string[]
} {
  const state = getSessionState(sessionID)
  return {
    hasCreatedTask: state.hasCreatedTask,
    editWriteCallCount: state.editWriteCallCount,
    taskCompletedCount: state.taskCompletedCount,
    lastReminderTime: state.lastReminderTime,
    activeTaskIds: Array.from(state.activeTaskIds),
  }
}

function createHook(configOverrides?: { editWriteBeforeTaskReminder?: number; reminderCooldownSeconds?: number }) {
  return createTaskLifecycleEnforcerHook(
    { directory: "/tmp" } as PluginInput,
    configOverrides,
  )
}

describe("Task Ownership Policy — Subagent Gate", () => {
  beforeEach(() => {
    subagentSessions.clear()
  })

  afterEach(() => {
    subagentSessions.clear()
    for (const sessionID of touchedSessionIDs) {
      deleteSession(sessionID)
    }
    touchedSessionIDs.clear()
  })

  it("skips tool.execute.after processing for subagent sessions on task_create", async () => {
    const sessionID = trackSessionID("ses-subagent-task-create")
    subagentSessions.add(sessionID)

    const hook = createHook()
    const before = snapshotState(sessionID)

    await hook["tool.execute.after"](
      { tool: "task_create", sessionID, callID: "call-subagent-task-create" },
      {
        title: "task_create",
        output: JSON.stringify({ task: { id: "T-subagent-1", status: "in_progress" } }),
        metadata: {},
      },
    )

    const after = snapshotState(sessionID)
    expect(after).toEqual(before)
  })

  it("skips tool.execute.after processing for subagent sessions on edit", async () => {
    const sessionID = trackSessionID("ses-subagent-edit")
    subagentSessions.add(sessionID)

    const hook = createHook({ editWriteBeforeTaskReminder: 1, reminderCooldownSeconds: 0 })
    const before = snapshotState(sessionID)
    const toolOutput = {
      title: "edit",
      output: "edit-ok",
      metadata: {},
    }

    await hook["tool.execute.after"](
      { tool: "edit", sessionID, callID: "call-subagent-edit" },
      toolOutput,
    )

    const after = snapshotState(sessionID)
    expect(after).toEqual(before)
    expect(toolOutput.output).toBe("edit-ok")
  })

  it("processes tool.execute.after normally for main session on task_create", async () => {
    const sessionID = trackSessionID("ses-main-task-create")
    const hook = createHook()

    await hook["tool.execute.after"](
      { tool: "task_create", sessionID, callID: "call-main-task-create" },
      {
        title: "task_create",
        output: JSON.stringify({ task: { id: "T-main-1", status: "in_progress" } }),
        metadata: {},
      },
    )

    const state = getSessionState(sessionID)
    expect(state.hasCreatedTask).toBe(true)
    expect(state.activeTaskIds.has("T-main-1")).toBe(true)
  })

  it("processes edit/write tools and increments editWriteCallCount for main sessions", async () => {
    const sessionID = trackSessionID("ses-main-edit-write")
    const hook = createHook({ editWriteBeforeTaskReminder: 99, reminderCooldownSeconds: 0 })

    await hook["tool.execute.after"](
      { tool: "edit", sessionID, callID: "call-main-edit" },
      {
        title: "edit",
        output: "edit-ok",
        metadata: {},
      },
    )

    await hook["tool.execute.after"](
      { tool: "write", sessionID, callID: "call-main-write" },
      {
        title: "write",
        output: "write-ok",
        metadata: {},
      },
    )

    const state = getSessionState(sessionID)
    expect(state.editWriteCallCount).toBe(2)
  })
})
