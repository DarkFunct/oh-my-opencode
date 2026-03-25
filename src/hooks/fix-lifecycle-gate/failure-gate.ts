import type { SessionCognitiveState, CognitiveFailure } from "../cognitive-governance-shared/types"
import { computeErrorTraceDepth, isSameDirectionRetry } from "../session-evidence-collector/failure-signals"

export function detectCognitiveFailureBlock(
	state: SessionCognitiveState,
): CognitiveFailure | null {
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

	if (isSameDirectionRetry(state)) {
		return {
			id: "F5",
			name: "Same Direction Retry",
			action: "block",
			directive: buildF5Directive(state.consecutiveFixFailures),
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
