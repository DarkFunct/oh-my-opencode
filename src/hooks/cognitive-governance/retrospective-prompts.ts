import type { DirectiveBlock } from "./delivery-verification-prompts"

export interface RetrospectiveConfig {
	enabled: boolean
	retrospective_threshold: number
	retrospective_priority: "critical" | "high" | "medium"
}

export const DEFAULT_RETROSPECTIVE_CONFIG: RetrospectiveConfig = {
	enabled: true,
	retrospective_threshold: 4,
	retrospective_priority: "critical",
}

export function buildRetrospectiveBlock(
	consecutiveFailures: number,
	config: RetrospectiveConfig,
): DirectiveBlock | null {
	if (!config.enabled) return null
	if (consecutiveFailures < config.retrospective_threshold) return null

	const content = [
		`📋 复盘协议 (Retrospective)`,
		`连续 ${consecutiveFailures} 次修复尝试未能解决问题。请执行系统性复盘：`,
		``,
		`1. 时间线回顾:`,
		`   - 每次修复尝试的操作和结果`,
		`   - 错误演变路径`,
		``,
		`2. 模式识别:`,
		`   - 是否存在共同失败模式`,
		`   - 是否在同一区域反复修改`,
		``,
		`3. 根因重评估:`,
		`   - CA 分析的根因是否正确`,
		`   - 是否有遗漏的前提假设`,
		``,
		`4. 策略调整:`,
		`   - 是否需要完全不同的解决方向`,
		`   - 是否需要咨询 Oracle`,
		``,
		`完成复盘后再决定下一步行动。`,
	].join("\n")

	return { content, priority: config.retrospective_priority }
}
