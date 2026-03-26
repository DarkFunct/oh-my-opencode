import type { MethodologySessionState } from "./types"

export function buildSkippedReadReminder(state: MethodologySessionState): string {
	return [
		"\n\n[⚠️ 方法论链 — Read 阶段缺失]",
		`已执行 ${state.executeCallCount} 次修改操作，但未检测到 Read 阶段（读取文件/搜索/LSP 查询）。`,
		"",
		"方法论链要求：Read(阅读) → Plan(方案) → Execute(执行) → Capture(沉淀)",
		"",
		"在继续修改前，请先：",
		"1. 阅读相关文件确认当前状态",
		"2. 基于阅读结果制定执行方案",
		"3. 然后再执行修改",
	].join("\n")
}

export function buildCaptureReminder(state: MethodologySessionState): string {
	return [
		"\n\n[📝 方法论链 — Capture 提醒]",
		`已完成 ${state.executeCallCount} 次执行操作。`,
		"",
		"方法论链要求在 Execute 后进入 Capture 阶段：",
		"- 产出知识沉淀（更新 _meta/knowledge/ 或声明无新增沉淀）",
		"- 如有新发现的约束/陷阱/决策，写入对应文档",
		"- 如确认无新增知识，显式声明：「Capture: 无新增知识沉淀」",
	].join("\n")
}

export function buildTaskCompletionNoCaptureWarning(): string {
	return [
		"\n\n[⚠️ 方法论链 — Capture 缺失]",
		"任务即将标记为 completed，但本周期未检测到 Capture 阶段。",
		"",
		"链条断裂 = 任务未完成。请在完成前：",
		"1. 声明知识沉淀结果（更新文档或声明「无新增知识沉淀」）",
		"2. 记录执行过程中发现的约束/陷阱/教训",
	].join("\n")
}

export function buildChatMessagePhaseStatus(state: MethodologySessionState): string {
	const hasSkippedRead = state.readCallCount === 0 && state.executeCallCount > 0
	const needsCapture = state.executeCallCount > 0 && !state.completedPhases.has("capture")

	if (!hasSkippedRead && !needsCapture) {
		return ""
	}

	const lines = [
		`\n<methodology-status phase="${state.currentPhase}" read="${state.readCallCount}" execute="${state.executeCallCount}">`,
	]

	if (hasSkippedRead) {
		lines.push("⚠️ 尚未执行 Read 阶段，请先阅读相关文件再继续修改")
	}

	if (needsCapture) {
		lines.push("📝 Execute 已进行，记得完成 Capture 阶段（知识沉淀）")
	}

	lines.push("</methodology-status>")
	return lines.join("\n")
}

export function buildCompactionStateCheckpoint(state: MethodologySessionState): string {
	const completedList = Array.from(state.completedPhases).join(", ") || "none"
	return [
		"<methodology-phase-state>",
		`current_phase: ${state.currentPhase}`,
		`completed_phases: [${completedList}]`,
		`tool_calls: ${state.toolCallCount}`,
		`execute_calls: ${state.executeCallCount}`,
		`read_calls: ${state.readCallCount}`,
		`has_active_task: ${state.hasActiveTask}`,
		"</methodology-phase-state>",
	].join("\n")
}
