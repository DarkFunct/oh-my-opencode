import type { SessionCognitiveState } from "../cognitive-governance-shared/types"

const KNOWLEDGE_PATH_PATTERNS = [
	/_meta\/knowledge\//,
	/lessons-learned/,
	/pitfalls/,
	/constraints/,
	/decisions/,
	/docs\/architecture\//,
	/docs\/decisions\//,
	/_meta\/harness\//,
]

export function computeErrorTraceDepth(state: SessionCognitiveState): number {
	const errorFiles = state.detectedErrors
		.map((e) => e.filePath)
		.filter((f): f is string => !!f)

	if (errorFiles.length === 0) return 1

	const uniqueErrorFiles = [...new Set(errorFiles)]
	const tracedFiles = new Set<string>()

	for (const errFile of uniqueErrorFiles) {
		if (state.readFiles.has(errFile)) {
			tracedFiles.add(errFile)
		}
	}

	return tracedFiles.size / uniqueErrorFiles.length
}

export function computeFixTargetConsistency(state: SessionCognitiveState): number {
	const errorFiles = state.detectedErrors
		.map((e) => e.filePath)
		.filter((f): f is string => !!f)
	const editedFiles = [...state.fileEditHistory.keys()]

	if (errorFiles.length === 0 || editedFiles.length === 0) return 1.0

	const uniqueErrorFiles = new Set(errorFiles)
	const overlap = editedFiles.filter((f) => uniqueErrorFiles.has(f)).length

	if (overlap === editedFiles.length) return 1.0
	if (overlap > 0) return 0.5
	return 0.0
}

export function hasReadKnowledgeFiles(state: SessionCognitiveState): boolean {
	for (const readFile of state.readFiles) {
		if (KNOWLEDGE_PATH_PATTERNS.some((p) => p.test(readFile))) {
			return true
		}
	}
	return false
}

export function isKnowledgeFile(filePath: string): boolean {
	return KNOWLEDGE_PATH_PATTERNS.some((p) => p.test(filePath))
}

export function isSameDirectionRetry(state: SessionCognitiveState): boolean {
	return (
		state.consecutiveFixFailures >= 2 &&
		state.newFilesReadSinceLastFailure === 0
	)
}
