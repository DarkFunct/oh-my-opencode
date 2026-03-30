import type { MethodologyDimension } from "../cognitive-governance-shared/types"

export interface RemediationAction {
	readonly description: string
	readonly readTargets: readonly string[]
	readonly signalHints: readonly string[]
}

export type RemediationMap = Readonly<Record<MethodologyDimension, RemediationAction>>

export const DEFAULT_REMEDIATION_MAP: RemediationMap = {
	technical: {
		description: "技术维度 — 工具、编译、类型检查",
		readTargets: [
			"tsconfig.json / package.json（项目配置）",
			"运行 lsp_diagnostics / typecheck / build 验证编译结果",
		],
		signalHints: ["api", "type", "schema", "compile", "tsc", "lint"],
	},
	empirical: {
		description: "经验维度 — 观察、实验、复现",
		readTargets: [
			"_meta/knowledge/pitfalls.md（已知陷阱与经验教训）",
			"_meta/knowledge/lessons-learned.md（历史问题诊断链）",
			"运行测试 / 检查日志 / 复现问题以获取一手观察数据",
		],
		signalHints: ["experiment", "observe", "sample", "reproduce", "logs"],
	},
	theoretical: {
		description: "理论维度 — 模型、不变量、契约",
		readTargets: [
			"docs/architecture/（架构设计文档）",
			"docs/decisions/（架构决策记录 D-xxx）",
			"相关模块的类型定义 / 接口契约文件",
		],
		signalHints: ["model", "invariant", "theory", "contract", "formal"],
	},
	engineering: {
		description: "工程维度 — 风险、边界、依赖、约束",
		readTargets: [
			"_meta/knowledge/constraints.md（约束登记）",
			"package.json / tsconfig.json（依赖与构建约束）",
			"评估变更范围（scope）、依赖影响（dependency）、风险边界（boundary）",
		],
		signalHints: ["risk", "boundary", "scope", "dependency", "latency", "budget"],
	},
	philosophical: {
		description: "哲学维度 — 元认知、前提质疑、权衡",
		readTargets: [
			"在 thinking 中进行前提质疑（为什么选择这个方案？前提假设是否正确？）",
			"检查是否存在隐含假设或未验证的前提",
			"权衡利弊（tradeoff），考虑替代方案",
		],
		signalHints: ["why", "premise", "meta-cognition", "tradeoff", "assumption challenge"],
	},
}

export function getMissingDimensions(
	covered: ReadonlySet<MethodologyDimension>,
): MethodologyDimension[] {
	const all: MethodologyDimension[] = ["technical", "empirical", "theoretical", "engineering", "philosophical"]
	return all.filter(d => !covered.has(d))
}

export function buildRemediationGuide(
	missing: readonly MethodologyDimension[],
	map: RemediationMap = DEFAULT_REMEDIATION_MAP,
): string {
	if (missing.length === 0) return ""

	const lines: string[] = ["**缺失维度与解除步骤：**", ""]

	for (const dim of missing) {
		const action = map[dim]
		lines.push(`### ${dim}: ${action.description}`)
		lines.push("操作指引：")
		for (const target of action.readTargets) {
			lines.push(`  - ${target}`)
		}
		lines.push(`触发关键词: ${action.signalHints.join(", ")}`)
		lines.push("")
	}

	return lines.join("\n")
}
