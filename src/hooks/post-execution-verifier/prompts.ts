import type { PostExecutionSessionState } from "./types"

export function buildStepVerificationReminder(state: PostExecutionSessionState): string {
	return [
		"\n\n[🔍 PRM 步骤验证提醒]",
		`已完成 ${state.executeStepCount} 步执行操作。`,
		"",
		"PRM 协议要求每步执行后验证：",
		"1. 执行结果是否符合预期？",
		"2. 是否引入新问题？（运行 lsp_diagnostics 检查）",
		"3. 变更范围是否在方案边界内？",
	].join("\n")
}

export function buildCompletionAuditReminder(state: PostExecutionSessionState): string {
	const fileList = Array.from(state.filesModified).slice(0, 10)
	const fileDisplay = fileList.length > 0
		? fileList.map(f => `  - ${f}`).join("\n")
		: "  (无记录)"
	const moreFiles = state.filesModified.size > 10
		? `\n  ... 及另外 ${state.filesModified.size - 10} 个文件`
		: ""

	return [
		"\n\n[📋 完成审计 — 变更范围确认]",
		`本周期修改了 ${state.filesModified.size} 个文件，执行了 ${state.bashCommandCount} 次命令：`,
		fileDisplay + moreFiles,
		"",
		"完成前请确认：",
		"1. lsp_diagnostics 在所有变更文件上无新增错误",
		"2. 变更范围未超出原始方案",
		"3. 无残留的调试代码或临时修改",
	].join("\n")
}
