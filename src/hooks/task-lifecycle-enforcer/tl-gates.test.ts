/// <reference types="bun-types/test-globals" />
import { createTaskLifecycleEnforcerHook } from "./index"
import { getSessionState, deleteSession } from "./state"
import { subagentSessions } from "../../features/claude-code-session-state"

function makeCtx(directory = "/test/project"): any {
	return { directory }
}

function makeOutput(title = "", output = "", metadata: Record<string, unknown> = {}): any {
	return { title, output, metadata }
}

function taskCreateOutput(id: string): string {
	return JSON.stringify({ task: { id, status: "pending" } })
}

function taskUpdateOutput(id: string, status: string): string {
	return JSON.stringify({ task: { id, status } })
}

function taskCompleteOutput(id: string): string {
	return JSON.stringify({
		task: {
			id,
			status: "completed",
			deliverables: ["src/foo.ts"],
			evidence: { diagnosticsClean: true },
		},
	})
}

function taskCompleteOutputNoEvidence(id: string): string {
	return JSON.stringify({ task: { id, status: "completed" } })
}

describe("TL-01: Non-trivial tasks must create TaskRecord [HARD_BLOCK]", () => {
	afterEach(() => deleteSession("tl01-sess"))

	it("should escalate from warning to HARD_BLOCK after sustained non-compliance", async () => {
		const hook = createTaskLifecycleEnforcerHook(makeCtx(), {
			editWriteBeforeTaskReminder: 2,
			reminderCooldownSeconds: 0,
		})

		const hardBlockThreshold = 10
		for (let i = 0; i < hardBlockThreshold; i++) {
			const out = makeOutput("edit", "ok")
			try {
				await hook["tool.execute.after"](
					{ tool: "edit", sessionID: "tl01-sess", callID: `call-${i}` },
					out,
				)
			} catch {
				// early throw acceptable
			}
		}

		const out = makeOutput("edit", "ok")
		await expect(
			hook["tool.execute.after"](
				{ tool: "edit", sessionID: "tl01-sess", callID: "call-final" },
				out,
			),
		).rejects.toThrow(/task/i)
	})

	it("should NOT hard-block if task has been created", async () => {
		const hook = createTaskLifecycleEnforcerHook(makeCtx(), {
			editWriteBeforeTaskReminder: 2,
			reminderCooldownSeconds: 0,
		})

		// given: task created
		const createOut = makeOutput("task_create", taskCreateOutput("T-1"))
		await hook["tool.execute.after"](
			{ tool: "task_create", sessionID: "tl01-sess", callID: "c1" },
			createOut,
		)

		// when: many edits follow
		for (let i = 0; i < 20; i++) {
			const out = makeOutput("edit", "ok")
			await hook["tool.execute.after"](
				{ tool: "edit", sessionID: "tl01-sess", callID: `c-${i}` },
				out,
			)
		}
	})

	it("should NOT hard-block subagent sessions (false-positive guard)", async () => {
		const hook = createTaskLifecycleEnforcerHook(makeCtx(), {
			editWriteBeforeTaskReminder: 2,
			reminderCooldownSeconds: 0,
		})

		const subagentSessionID = "ses_abc123_sub_def456"
		subagentSessions.add(subagentSessionID)

		try {
			for (let i = 0; i < 20; i++) {
				const out = makeOutput("edit", "ok")
				await hook["tool.execute.after"](
					{ tool: "edit", sessionID: subagentSessionID, callID: `c-${i}` },
					out,
				)
			}
		} finally {
			subagentSessions.delete(subagentSessionID)
		}
	})
})

describe("TL-02: Execution steps must mark in_progress [MUST]", () => {
	afterEach(() => deleteSession("tl02-sess"))

	it("should inject warning when executing edit with task pending but not in_progress", async () => {
		const hook = createTaskLifecycleEnforcerHook(makeCtx(), {
			editWriteBeforeTaskReminder: 2,
			reminderCooldownSeconds: 0,
		})

		// given: task created (pending)
		const createOut = makeOutput("task_create", taskCreateOutput("T-2"))
		await hook["tool.execute.after"](
			{ tool: "task_create", sessionID: "tl02-sess", callID: "c1" },
			createOut,
		)

		// when: edit without marking in_progress
		const editOut = makeOutput("edit", "ok")
		await hook["tool.execute.after"](
			{ tool: "edit", sessionID: "tl02-sess", callID: "c2" },
			editOut,
		)

		// then: TL-02 warning injected
		expect(editOut.output).toContain("TL-02")
	})

	it("should NOT warn when task is already in_progress", async () => {
		const hook = createTaskLifecycleEnforcerHook(makeCtx(), {
			editWriteBeforeTaskReminder: 2,
			reminderCooldownSeconds: 0,
		})

		// given: task created and marked in_progress
		const createOut = makeOutput("task_create", taskCreateOutput("T-2b"))
		await hook["tool.execute.after"](
			{ tool: "task_create", sessionID: "tl02-sess", callID: "c1" },
			createOut,
		)
		const updateOut = makeOutput("task_update", taskUpdateOutput("T-2b", "in_progress"))
		await hook["tool.execute.after"](
			{ tool: "task_update", sessionID: "tl02-sess", callID: "c2" },
			updateOut,
		)

		// when: edit
		const editOut = makeOutput("edit", "ok")
		await hook["tool.execute.after"](
			{ tool: "edit", sessionID: "tl02-sess", callID: "c3" },
			editOut,
		)

		// then: no TL-02 warning
		expect(editOut.output).not.toContain("TL-02")
	})
})

describe("TL-03: Steps completed must update task status [MUST]", () => {
	afterEach(() => deleteSession("tl03-sess"))

	it("should inject TL-03 reminder after N executions without status update", async () => {
		const hook = createTaskLifecycleEnforcerHook(makeCtx(), {
			editWriteBeforeTaskReminder: 2,
			reminderCooldownSeconds: 0,
		})

		// given: task in_progress
		const createOut = makeOutput("task_create", taskCreateOutput("T-3"))
		await hook["tool.execute.after"](
			{ tool: "task_create", sessionID: "tl03-sess", callID: "c1" },
			createOut,
		)
		const updateOut = makeOutput("task_update", taskUpdateOutput("T-3", "in_progress"))
		await hook["tool.execute.after"](
			{ tool: "task_update", sessionID: "tl03-sess", callID: "c2" },
			updateOut,
		)

		// when: many edits without task_update
		const stepsWithoutUpdate = 8
		let lastOutput: any
		for (let i = 0; i < stepsWithoutUpdate; i++) {
			lastOutput = makeOutput("edit", "ok")
			await hook["tool.execute.after"](
				{ tool: "edit", sessionID: "tl03-sess", callID: `c-${i}` },
				lastOutput,
			)
		}

		// then: TL-03 reminder injected
		expect(lastOutput.output).toContain("TL-03")
	})

	it("should NOT inject TL-03 if task_update was called recently", async () => {
		const hook = createTaskLifecycleEnforcerHook(makeCtx(), {
			editWriteBeforeTaskReminder: 2,
			reminderCooldownSeconds: 0,
		})

		// given: task in_progress
		const createOut = makeOutput("task_create", taskCreateOutput("T-3b"))
		await hook["tool.execute.after"](
			{ tool: "task_create", sessionID: "tl03-sess", callID: "c1" },
			createOut,
		)
		const progressOut = makeOutput("task_update", taskUpdateOutput("T-3b", "in_progress"))
		await hook["tool.execute.after"](
			{ tool: "task_update", sessionID: "tl03-sess", callID: "c2" },
			progressOut,
		)

		// when: a few edits, then task_update, then more edits
		for (let i = 0; i < 3; i++) {
			const out = makeOutput("edit", "ok")
			await hook["tool.execute.after"](
				{ tool: "edit", sessionID: "tl03-sess", callID: `c-a-${i}` },
				out,
			)
		}

		const statusOut = makeOutput("task_update", taskUpdateOutput("T-3b", "in_progress"))
		await hook["tool.execute.after"](
			{ tool: "task_update", sessionID: "tl03-sess", callID: "c-update" },
			statusOut,
		)

		for (let i = 0; i < 3; i++) {
			const out = makeOutput("edit", "ok")
			await hook["tool.execute.after"](
				{ tool: "edit", sessionID: "tl03-sess", callID: `c-b-${i}` },
				out,
			)
		}

		const finalOut = makeOutput("edit", "ok")
		await hook["tool.execute.after"](
			{ tool: "edit", sessionID: "tl03-sess", callID: "c-final" },
			finalOut,
		)

		// then: no TL-03
		expect(finalOut.output).not.toContain("TL-03")
	})
})

describe("TL-04: completed must have deliverables + evidence [HARD_BLOCK]", () => {
	afterEach(() => deleteSession("tl04-sess"))

	it("should reject task completion without evidence", async () => {
		const hook = createTaskLifecycleEnforcerHook(makeCtx(), {
			editWriteBeforeTaskReminder: 2,
			reminderCooldownSeconds: 0,
		})

		// given: task created
		const createOut = makeOutput("task_create", taskCreateOutput("T-4"))
		await hook["tool.execute.after"](
			{ tool: "task_create", sessionID: "tl04-sess", callID: "c1" },
			createOut,
		)

		// when: complete without evidence
		const completeOut = makeOutput("task_update", taskCompleteOutputNoEvidence("T-4"))
		await hook["tool.execute.after"](
			{ tool: "task_update", sessionID: "tl04-sess", callID: "c2" },
			completeOut,
		)

		// then: TL-04 rejection
		expect(completeOut.output).toContain("TL-04")
	})

	it("should accept task completion with evidence", async () => {
		const hook = createTaskLifecycleEnforcerHook(makeCtx(), {
			editWriteBeforeTaskReminder: 2,
			reminderCooldownSeconds: 0,
		})

		// given: task created
		const createOut = makeOutput("task_create", taskCreateOutput("T-4b"))
		await hook["tool.execute.after"](
			{ tool: "task_create", sessionID: "tl04-sess", callID: "c1" },
			createOut,
		)

		// when: complete with evidence
		const completeOut = makeOutput("task_update", taskCompleteOutput("T-4b"))
		await hook["tool.execute.after"](
			{ tool: "task_update", sessionID: "tl04-sess", callID: "c2" },
			completeOut,
		)

		// then: no TL-04 warning
		expect(completeOut.output).not.toContain("TL-04")
	})
})

describe("TL-06: Session end must handle all in_progress tasks [MUST]", () => {
	afterEach(() => deleteSession("tl06-sess"))

	it("should inject unresolved task warning at compaction when tasks are still active", async () => {
		const hook = createTaskLifecycleEnforcerHook(makeCtx(), {
			editWriteBeforeTaskReminder: 2,
			reminderCooldownSeconds: 0,
		})

		// given: task created (in activeTaskIds)
		const createOut = makeOutput("task_create", taskCreateOutput("T-6"))
		await hook["tool.execute.after"](
			{ tool: "task_create", sessionID: "tl06-sess", callID: "c1" },
			createOut,
		)

		// when: compaction with active tasks
		const compactionOutput = { context: [] as string[] }
		await hook["experimental.session.compacting"](
			{ sessionID: "tl06-sess" },
			compactionOutput,
		)

		// then: TL-06 warning
		const injected = compactionOutput.context.join("\n")
		expect(injected).toContain("TL-06")
	})

	it("should NOT inject TL-06 when all tasks are completed", async () => {
		const hook = createTaskLifecycleEnforcerHook(makeCtx(), {
			editWriteBeforeTaskReminder: 2,
			reminderCooldownSeconds: 0,
		})

		// given: task created and completed
		const createOut = makeOutput("task_create", taskCreateOutput("T-6b"))
		await hook["tool.execute.after"](
			{ tool: "task_create", sessionID: "tl06-sess", callID: "c1" },
			createOut,
		)
		const completeOut = makeOutput("task_update", taskCompleteOutput("T-6b"))
		await hook["tool.execute.after"](
			{ tool: "task_update", sessionID: "tl06-sess", callID: "c2" },
			completeOut,
		)

		// when: compaction
		const compactionOutput = { context: [] as string[] }
		await hook["experimental.session.compacting"](
			{ sessionID: "tl06-sess" },
			compactionOutput,
		)

		// then: no TL-06 warning
		const injected = compactionOutput.context.join("\n")
		expect(injected).not.toContain("TL-06")
	})
})

describe("False-positive guards", () => {
	afterEach(() => {
		deleteSession("fp-single")
		deleteSession("fp-read")
	})

	it("should NOT trigger TL-01 hard block for single-step trivial tasks", async () => {
		const hook = createTaskLifecycleEnforcerHook(makeCtx(), {
			editWriteBeforeTaskReminder: 2,
			reminderCooldownSeconds: 0,
		})

		const out = makeOutput("edit", "ok")
		await hook["tool.execute.after"](
			{ tool: "edit", sessionID: "fp-single", callID: "c1" },
			out,
		)

		expect(out.output).toBe("ok")
	})

	it("should NOT count read-only tools toward TL-01 edit threshold", async () => {
		const hook = createTaskLifecycleEnforcerHook(makeCtx(), {
			editWriteBeforeTaskReminder: 2,
			reminderCooldownSeconds: 0,
		})

		for (let i = 0; i < 30; i++) {
			const out = makeOutput("read", "file content")
			await hook["tool.execute.after"](
				{ tool: "read", sessionID: "fp-read", callID: `c-${i}` },
				out,
			)
		}

		const state = getSessionState("fp-read")
		expect(state.editWriteCallCount).toBe(0)
	})
})
