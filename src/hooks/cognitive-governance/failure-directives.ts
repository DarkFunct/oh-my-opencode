import type { SessionCognitiveState } from "../cognitive-governance-shared/types"
import { computeFixTargetConsistency, hasReadKnowledgeFiles } from "../session-evidence-collector/failure-signals"

const F3_WARN_THRESHOLD = 4

export function detectCognitiveFailureWarn(
	state: SessionCognitiveState,
): string | null {
	if (state.detectedErrors.length > 0 && state.fileEditHistory.size > 0) {
		const consistency = computeFixTargetConsistency(state)
		if (consistency < 1.0) {
			const errorFiles = state.detectedErrors
				.map((e) => e.filePath)
				.filter((f): f is string => !!f)
			const editedFiles = [...state.fileEditHistory.keys()]
			return buildF2Directive([...new Set(errorFiles)], editedFiles, consistency)
		}
	}

	if (state.editsSinceLastVerification >= F3_WARN_THRESHOLD) {
		return buildF3WarnDirective(state.editsSinceLastVerification)
	}

	if (state.executePhaseActive && !hasReadKnowledgeFiles(state)) {
		return buildF4Directive(false)
	}

	if (
		state.consecutiveFixFailures > 0 &&
		!state.knowledgeReadSinceLastFailure
	) {
		return buildF4Directive(true)
	}

	return null
}

function buildF2Directive(errorFiles: string[], editedFiles: string[], consistency: number): string {
	const errList = errorFiles.slice(0, 3).join(", ")
	const editList = editedFiles.slice(0, 3).join(", ")
	if (consistency === 0) {
		return (
			`[⚠️ F2: 修复方向偏离] 错误源于 ${errList}，` +
			`但你在编辑 ${editList}。建议先验证因果链是否正确。`
		)
	}
	const pct = Math.round(consistency * 100)
	return (
		`[⚠️ F2: 修复方向部分偏离] 错误源于 ${errList}，` +
		`当前编辑文件仅 ${pct}% 与错误源重叠。确认其余编辑与修复目标相关。`
	)
}

function buildF3WarnDirective(editCount: number): string {
	return (
		`[⚠️ F3: 改而不验] 已连续编辑 ${editCount} 个文件未运行验证。` +
		`建议执行 lsp_diagnostics 或 typecheck 确认无回归。`
	)
}

function buildF4Directive(afterFailure: boolean): string {
	if (afterFailure) {
		return (
			`[⚠️ F4: 经验盲区] 修复失败后未重新查阅知识库。` +
			`建议 read _meta/knowledge/pitfalls.md 和 lessons-learned.md 检查是否有相关已知问题。`
		)
	}
	return (
		`[⚠️ F4: 经验盲区] 进入 Execute 前未查阅知识库。` +
		`建议 read _meta/knowledge/pitfalls.md 和 constraints.md 检查已知陷阱。`
	)
}
