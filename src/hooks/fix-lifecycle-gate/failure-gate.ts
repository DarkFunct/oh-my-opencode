import type { SessionCognitiveState, CognitiveFailure } from "../cognitive-governance-shared/types"
import { computeErrorTraceDepth, computeFixTargetConsistency, isSameDirectionRetry } from "../session-evidence-collector/failure-signals"
import type { FixLifecycleGateConfig } from "./config"
import { DEFAULT_FIX_LIFECYCLE_GATE_CONFIG } from "./config"

export function detectCognitiveFailureBlock(
	state: SessionCognitiveState,
	config: FixLifecycleGateConfig = DEFAULT_FIX_LIFECYCLE_GATE_CONFIG,
): CognitiveFailure | null {
	// F1: Blind Execution — errors detected but source files not read
	if (state.detectedErrors.length > 0 && state.executePhaseActive) {
		const traceDepth = computeErrorTraceDepth(state)
		if (traceDepth === 0) {
			const errorFiles = state.detectedErrors
				.map((e) => e.filePath)
				.filter((f): f is string => !!f)
			const uniqueFiles = [...new Set(errorFiles)]
			return {
				id: "F1",
				name: "Blind Execution",
				action: "block",
				directive: buildF1Directive(uniqueFiles),
			}
		}
	}

	// F3: Unverified Changes — too many edits without running verification
	// Progressive: warn at ≥4 (L3 failure-directives.ts), block at ≥5 (here)
	if (state.editsSinceLastVerification >= config.f3BlockThreshold) {
		return {
			id: "F3",
			name: "Unverified Changes",
			action: "block",
			directive: buildF3Directive(state.editsSinceLastVerification),
		}
	}

	// F5: Same Direction Retry — consecutive failures with no new investigation
	if (isSameDirectionRetry(state)) {
		return {
			id: "F5",
			name: "Same Direction Retry",
			action: "block",
			directive: buildF5Directive(state.consecutiveFixFailures),
		}
	}

	// F2: Fix Direction Mismatch — repeated failures with zero overlap between error source and edit targets
	if (state.consecutiveFixFailures >= config.f2f4BlockThreshold) {
		const consistency = computeFixTargetConsistency(state)
		if (consistency === 0 && state.detectedErrors.length > 0 && state.fileEditHistory.size > 0) {
			const errorFiles = state.detectedErrors
				.map((e) => e.filePath)
				.filter((f): f is string => !!f)
			return {
				id: "F2",
				name: "Fix Direction Mismatch",
				action: "block",
				directive: buildF2BlockDirective([...new Set(errorFiles)], config.f2f4BlockThreshold),
			}
		}
	}

	// F4: Knowledge Blindspot — repeated failures without consulting knowledge base
	if (
		state.consecutiveFixFailures >= config.f2f4BlockThreshold &&
		!state.knowledgeReadSinceLastFailure &&
		state.newFilesReadSinceLastFailure === 0
	) {
		return {
			id: "F4",
			name: "Knowledge Blindspot",
			action: "block",
			directive: buildF4BlockDirective(state.consecutiveFixFailures),
		}
	}

	return null
}

function buildF1Directive(errorSourceFiles: string[]): string {
	const fileList = errorSourceFiles.slice(0, 5).join(", ")
	return (
		`[🛑 F1: 盲目执行] 检测到错误来源文件未被读取。` +
		`错误涉及: ${fileList}。` +
		`请先 read 这些文件追踪错误传播路径，再执行修复。`
	)
}

function buildF5Directive(failureCount: number): string {
	return (
		`[🛑 F5: 同向重试] 连续 ${failureCount} 次修复失败，且未读取新文件。` +
		`当前修复方向可能错误。请读取新文件重新取证，改变调查方向。`
	)
}

function buildF3Directive(editCount: number): string {
	return (
		`[🛑 F3: 改而不验] 已连续编辑 ${editCount} 个文件未运行验证。` +
		`请先执行 lsp_diagnostics 或 typecheck 确认无回归，再继续编辑。`
	)
}

function buildF2BlockDirective(errorSourceFiles: string[], threshold: number): string {
	const fileList = errorSourceFiles.slice(0, 5).join(", ")
	return (
		`[🛑 F2: 修复方向偏离] 连续 ${threshold} 次失败且编辑目标与错误源零重叠。` +
		`错误涉及: ${fileList}。请 read 错误源文件重新定位根因。`
	)
}

function buildF4BlockDirective(failureCount: number): string {
	return (
		`[🛑 F4: 经验盲区] 连续 ${failureCount} 次修复失败且未查阅知识库。` +
		`请 read _meta/knowledge/pitfalls.md 和 lessons-learned.md 检查已知解决方案。`
	)
}
