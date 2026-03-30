export interface BatchClassificationConfig {
	enabled: boolean
	batch_threshold: number
	classification_marker_patterns: string[]
}

export const DEFAULT_BATCH_CLASSIFICATION_CONFIG: BatchClassificationConfig = {
	enabled: true,
	batch_threshold: 5,
	classification_marker_patterns: [
		"^\\[.+\\]",
		"^\\(.+\\)",
	],
}

export type BatchClassificationReason = "batch_unclassified" | null

export interface BatchClassificationResult {
	shouldBlock: boolean
	reason: BatchClassificationReason
	itemCount: number
	threshold: number
}

export function evaluateBatchClassification(
	todoContents: string[],
	config: BatchClassificationConfig,
): BatchClassificationResult {
	const base = { itemCount: todoContents.length, threshold: config.batch_threshold }

	if (!config.enabled || todoContents.length <= config.batch_threshold) {
		return { ...base, shouldBlock: false, reason: null }
	}

	const patterns = config.classification_marker_patterns.map(p => new RegExp(p))
	const classifiedCount = todoContents.filter(
		content => patterns.some(p => p.test(content.trim())),
	).length

	// Majority must be classified (> 50%)
	const majorityClassified = classifiedCount > todoContents.length / 2

	if (majorityClassified) {
		return { ...base, shouldBlock: false, reason: null }
	}

	return { ...base, shouldBlock: true, reason: "batch_unclassified" }
}
