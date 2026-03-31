// F1~F5 阻断型指令 + 维度修复指引 (Remediation + Cognitive Failure Prompts)

import type { MethodologyDimension } from "../../hooks/cognitive-governance-shared/types"

// F1: 盲目执行 (Blind Execution)
export function f1BlockDirective(errorSourceFiles: string[]): string {
	const fileList = errorSourceFiles.slice(0, 5).join(", ")
	return (
		`[🛑 F1: Blind Execution] Error source files have NOT been read. ` +
		`Errors involve: ${fileList}. ` +
		`You MUST read these files to trace error propagation paths BEFORE attempting any fix.`
	)
}

// F2: 修复方向偏离 (Fix Direction Mismatch — block level)
export function f2BlockDirective(errorSourceFiles: string[], threshold: number): string {
	const fileList = errorSourceFiles.slice(0, 5).join(", ")
	return (
		`[🛑 F2: Fix Direction Mismatch] ${threshold} consecutive failures with ZERO overlap between edit targets and error sources. ` +
		`Errors involve: ${fileList}. You MUST read the error source files to re-locate the root cause.`
	)
}

// F3: 改而不验 (Unverified Changes — block level)
export function f3BlockDirective(editCount: number): string {
	return (
		`[🛑 F3: Unverified Changes] ${editCount} files edited without running verification. ` +
		`You MUST run lsp_diagnostics or typecheck to confirm no regressions BEFORE making further edits.`
	)
}

// F4: 经验盲区 (Knowledge Blindspot — block level)
export function f4BlockDirective(failureCount: number): string {
	return (
		`[🛑 F4: Knowledge Blindspot] ${failureCount} consecutive fix failures without consulting knowledge base. ` +
		`You MUST read _meta/knowledge/pitfalls.md and lessons-learned.md to check for known solutions.`
	)
}

// F5: 同向重试 (Same Direction Retry)
export function f5BlockDirective(failureCount: number): string {
	return (
		`[🛑 F5: Same Direction Retry] ${failureCount} consecutive fix failures with no new file investigation. ` +
		`Your current fix direction is likely WRONG. You MUST read new files to re-gather evidence and change approach.`
	)
}

// 方法论覆盖阻断 (Methodology Coverage Block)
export function methodologyCoverageBlock(
	complexity: string, required: number, actual: number, deficit: number,
	warningCount: number, coveredList: string, missingList: string,
	remediationGuide: string,
): string {
	return [
		`[🛑 Methodology Coverage] Task complexity: ${complexity}. Required: ${required} methodology dimensions, current: only ${actual} (deficit: ${deficit}).`,
		"",
		`Covered dimensions: ${coveredList}`,
		`Missing dimensions: ${missingList}`,
		`Consecutive warnings: ${warningCount}`,
		"",
		remediationGuide,
		"Complete ANY missing dimension's actions above to automatically unblock this gate.",
	].join("\n")
}

export interface RemediationActionEN {
	readonly description: string
	readonly readTargets: readonly string[]
	readonly signalHints: readonly string[]
}

export type RemediationMapEN = Readonly<Record<MethodologyDimension, RemediationActionEN>>

// 维度修复指引 (Dimension Remediation Map — English with Chinese annotations in comments)
export const DEFAULT_REMEDIATION_MAP_EN: RemediationMapEN = {
	technical: {
		// 技术维度 — 工具、编译、类型检查
		description: "Technical — tools, compilation, type checking",
		readTargets: [
			"tsconfig.json / package.json (project configuration)",
			"Run lsp_diagnostics / typecheck / build to verify compilation results",
		],
		signalHints: ["api", "type", "schema", "compile", "tsc", "lint"],
	},
	empirical: {
		// 经验维度 — 观察、实验、复现
		description: "Empirical — observation, experimentation, reproduction",
		readTargets: [
			"_meta/knowledge/pitfalls.md (known pitfalls and lessons learned)",
			"_meta/knowledge/lessons-learned.md (historical problem diagnosis chains)",
			"Run tests / check logs / reproduce issues for first-hand observation data",
		],
		signalHints: ["experiment", "observe", "sample", "reproduce", "logs"],
	},
	theoretical: {
		// 理论维度 — 模型、不变量、契约
		description: "Theoretical — models, invariants, contracts",
		readTargets: [
			"docs/architecture/ (architecture design documents)",
			"docs/decisions/ (architecture decision records D-xxx)",
			"Related module type definitions / interface contract files",
		],
		signalHints: ["model", "invariant", "theory", "contract", "formal"],
	},
	engineering: {
		// 工程维度 — 风险、边界、依赖、约束
		description: "Engineering — risk, boundaries, dependencies, constraints",
		readTargets: [
			"_meta/knowledge/constraints.md (constraint registry)",
			"package.json / tsconfig.json (dependency and build constraints)",
			"Evaluate change scope, dependency impact, and risk boundaries",
		],
		signalHints: ["risk", "boundary", "scope", "dependency", "latency", "budget"],
	},
	philosophical: {
		// 哲学维度 — 元认知、前提质疑、权衡
		description: "Philosophical — meta-cognition, premise questioning, tradeoffs",
		readTargets: [
			"In thinking: question premises (Why this approach? Are assumptions valid?)",
			"Check for hidden assumptions or unverified premises",
			"Weigh tradeoffs, consider alternative approaches",
		],
		signalHints: ["why", "premise", "meta-cognition", "tradeoff", "assumption challenge"],
	},
}

export function buildRemediationGuideEN(
	missing: readonly MethodologyDimension[],
	map: RemediationMapEN = DEFAULT_REMEDIATION_MAP_EN,
): string {
	if (missing.length === 0) return ""

	const lines: string[] = ["**Missing Dimensions & Unblock Steps:**", ""]

	for (const dim of missing) {
		const action = map[dim]
		lines.push(`### ${dim}: ${action.description}`)
		lines.push("Action guide:")
		for (const target of action.readTargets) {
			lines.push(`  - ${target}`)
		}
		lines.push(`Trigger keywords: ${action.signalHints.join(", ")}`)
		lines.push("")
	}

	return lines.join("\n")
}

export const REMEDIATION = {
	f1BlockDirective,
	f2BlockDirective,
	f3BlockDirective,
	f4BlockDirective,
	f5BlockDirective,
	methodologyCoverageBlock,
	DEFAULT_REMEDIATION_MAP_EN,
	buildRemediationGuideEN,
}
