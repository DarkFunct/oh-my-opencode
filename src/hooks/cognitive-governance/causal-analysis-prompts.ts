import type { DirectiveBlock } from "./delivery-verification-prompts"

export function buildCausalAnalysisBlock(
	consecutiveFailures: number,
	threshold: number,
): DirectiveBlock | null {
	if (consecutiveFailures < threshold) return null

	const content = [
		`🔍 因果分析协议 (CA-01 → CA-02)`,
		`连续 ${consecutiveFailures} 次修复失败。在继续修复之前，完成结构化分析：`,
		``,
		`1. 问题陈述 (CA-01):`,
		`   现象 (What):`,
		`   位置 (Where):`,
		`   时机 (When):`,
		`   影响 (Impact):`,
		`   复现 (Reproduction):`,
		``,
		`2. 三层因果分析 (CA-02):`,
		`   近因:`,
		`   促成条件:`,
		`   潜在条件:`,
		`   5 Whys: Why-1 → Why-2 → Why-3 →`,
		``,
		`完成分析后再执行修复操作。`,
	].join("\n")

	return { content, priority: "critical" }
}
