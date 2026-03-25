import type { TaskLifecycleSessionState } from "./types"

export function buildNoTaskCreatedReminder(state: TaskLifecycleSessionState): string {
	return [
		"\n\n[⚠️ 任务生命周期 — 未创建任务]",
		`已执行 ${state.editWriteCallCount} 次修改操作，但未创建任何 Task。`,
		"",
		"多步骤工作必须通过 task_create 创建任务以：",
		"- 提供用户可见的实时进度",
		"- 防止范围漂移",
		"- 支持中断后恢复",
		"",
		"请使用 task_create 创建任务，然后通过 task_update 跟踪进度。",
	].join("\n")
}

export function buildChatMessageTaskStatus(state: TaskLifecycleSessionState): string {
	if (!state.hasCreatedTask && state.editWriteCallCount === 0) {
		return ""
	}

	const activeIds = Array.from(state.activeTaskIds)
	const lines = [
		`\n<task-lifecycle-status>`,
	]

	if (activeIds.length > 0) {
		lines.push(`活跃任务: ${activeIds.join(", ")}`)
		lines.push(`已完成: ${state.taskCompletedCount}`)
	} else if (state.editWriteCallCount > 0 && !state.hasCreatedTask) {
		lines.push(`⚠️ 已执行 ${state.editWriteCallCount} 次修改操作但未创建任何 Task`)
		lines.push("多步骤工作必须先 task_create 创建任务")
	} else if (state.hasCreatedTask && activeIds.length === 0) {
		lines.push(`所有任务已完成 (共 ${state.taskCompletedCount})`)
	}

	lines.push("</task-lifecycle-status>")
	return lines.join("\n")
}

export function buildCompactionCheckpoint(state: TaskLifecycleSessionState): string {
	const activeIds = Array.from(state.activeTaskIds).join(", ") || "none"
	return [
		"<task-lifecycle-state>",
		`has_created_task: ${state.hasCreatedTask}`,
		`edit_write_calls: ${state.editWriteCallCount}`,
		`active_task_ids: [${activeIds}]`,
		`completed_count: ${state.taskCompletedCount}`,
		"</task-lifecycle-state>",
	].join("\n")
}
