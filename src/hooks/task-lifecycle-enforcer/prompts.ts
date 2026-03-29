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
	const hasEditsWithoutTask = state.editWriteCallCount > 0 && !state.hasCreatedTask

	if (!hasEditsWithoutTask) {
		return ""
	}

	return [
		`\n<task-lifecycle-status>`,
		`⚠️ 已执行 ${state.editWriteCallCount} 次修改操作但未创建任何 Task`,
		"多步骤工作必须先 task_create 创建任务",
		"</task-lifecycle-status>",
	].join("\n")
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

export function buildTL02Warning(): string {
	return [
		"\n\n[TL-02 ⚠️ 任务未标记 in_progress]",
		"已创建任务但未将其标记为 in_progress。",
		"在执行修改操作前，请先使用 task_update 将当前任务标记为 in_progress。",
	].join("\n")
}

export function buildTL03Reminder(editsSinceLastUpdate: number): string {
	return [
		`\n\n[TL-03 ⚠️ 任务状态需要更新]`,
		`已连续执行 ${editsSinceLastUpdate} 次修改操作但未更新任务状态。`,
		"请使用 task_update 更新当前任务进度，以保持用户可见的实时跟踪。",
	].join("\n")
}

export function buildTL04Rejection(): string {
	return [
		"\n\n[TL-04 🛑 任务完成缺少交付物或证据]",
		"标记任务为 completed 时必须包含 deliverables（交付物列表）和 evidence（验证证据）。",
		"请补充后重新提交 task_update。",
	].join("\n")
}

export function buildTL06Warning(activeIds: string[]): string {
	return [
		"\n\n[TL-06 ⚠️ 会话压缩时存在未结束的任务]",
		`仍有 ${activeIds.length} 个活跃任务未完成: [${activeIds.join(", ")}]`,
		"请在会话结束前处理这些任务（完成、终止或回滚）。",
	].join("\n")
}

export function buildTL05Warning(commitHash: string, message: string): string {
	return [
		"\n\n[TL-05 ⚠️ Git commit 未关联任务]",
		`Commit ${commitHash} 的提交消息中未包含任何任务引用。`,
		`消息: "${message}"`,
		"",
		"建议在 commit message 中包含任务引用（如 T-{uuid} 或 [T-{uuid}]），",
		"以便自动追踪 VCS 与任务的关联关系。",
	].join("\n")
}

export function buildTL07RevertInfo(commitHash: string, message: string): string {
	return [
		"\n\n[TL-07 ℹ️ 检测到 Revert Commit]",
		`Commit ${commitHash} 是一个 revert 操作。`,
		`消息: "${message}"`,
		"",
		"如果原 commit 关联了任务，对应任务应被标记为 rolled_back。",
		"请确认任务状态是否需要更新。",
	].join("\n")
}
