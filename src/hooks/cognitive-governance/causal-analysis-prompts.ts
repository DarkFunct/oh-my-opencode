import type { DirectiveBlock } from "./delivery-verification-prompts"

export interface CausalAnalysisOptions {
	include_counterfactual?: boolean
	include_boundary_closure?: boolean
}

const DEFAULT_CA_OPTIONS: CausalAnalysisOptions = {
	include_counterfactual: true,
	include_boundary_closure: true,
}

export function buildCausalAnalysisBlock(
	consecutiveFailures: number,
	threshold: number,
	options?: CausalAnalysisOptions,
): DirectiveBlock | null {
	if (consecutiveFailures < threshold) return null

	const opts = { ...DEFAULT_CA_OPTIONS, ...options }

	const lastStep = opts.include_boundary_closure ? "CA-04"
		: opts.include_counterfactual ? "CA-03"
			: "CA-02"

	const sections: string[] = [
		`🔍 因果分析协议 (CA-01 → ${lastStep})`,
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
	]

	if (opts.include_counterfactual) {
		sections.push(
			``,
			`3. 反事实推导 (CA-03):`,
			`   假设验证:`,
			`   - 如果根因不存在，问题是否仍会发生？`,
			`   - 如果修复根因，问题是否确定消失？`,
			`   反事实检验:`,
			`   - 列出至少一个替代假说`,
			`   - 说明为何排除该假说`,
		)
	}

	if (opts.include_boundary_closure) {
		sections.push(
			``,
			`4. 问题边界与行动闭环 (CA-04):`,
			`   边界划定:`,
			`   - 本次修复的范围（只修什么）`,
			`   - 不在范围内的相关问题（记录但不修）`,
			`   行动计划:`,
			`   - 具体修复步骤（按顺序）`,
			`   - 每步的验证方法`,
			`   验收标准:`,
			`   - 问题消失的判定条件`,
			`   - 回归验证命令`,
		)
	}

	sections.push(``, `完成分析后再执行修复操作。`)

	return { content: sections.join("\n"), priority: "critical" }
}
