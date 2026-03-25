import type { RepeatFixVerdict } from "./repeat-fix-detector"

export function buildBlockMessage(verdict: RepeatFixVerdict): string {
	const lines = [
		"[🛑 Fix Lifecycle Gate] 重复修复被拦截",
		"",
	]

	if (verdict.reason === "consecutive_failures") {
		lines.push(
			`检测到连续 ${verdict.fixCount} 次修复失败。`,
			"",
			"Harness 认知治理要求：",
			"1. **停止当前修复路径** — 症状修复无效说明根因未定位",
			"2. **回退到最近的已知良好状态** (git checkout / undo edits)",
			"3. **重新进入感知层** — 用 Read/Grep/LSP 重新取证",
			"4. **记录失败链** — 写入 _meta/knowledge/lessons-learned.md",
			"5. **如需帮助** — 咨询 Oracle 获取架构级建议",
		)
	} else if (verdict.reason === "same_file_repeated") {
		lines.push(
			`文件 \`${verdict.target}\` 已被修改 ${verdict.fixCount} 次但错误未解决。`,
			"",
			"Harness 认知治理要求：",
			"1. **停止对该文件的反复修改**",
			"2. **审视悟性层** — 当前对问题的理解是否正确？",
			"3. **扩大感知范围** — 错误根因可能在其他文件",
			"4. **考虑回退** — 恢复文件到修改前状态重新分析",
		)
	}

	return lines.join("\n")
}
