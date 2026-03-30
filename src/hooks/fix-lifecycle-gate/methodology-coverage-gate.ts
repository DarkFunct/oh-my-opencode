export type TaskComplexity = "simple" | "standard" | "complex"

export interface ComplexityThresholds {
	complex_module_count: number
	complex_todo_count: number
	complex_file_count: number
	standard_module_count: number
	standard_todo_count: number
	standard_file_count: number
}

export const DEFAULT_COMPLEXITY_THRESHOLDS: ComplexityThresholds = {
	complex_module_count: 3,
	complex_todo_count: 8,
	complex_file_count: 10,
	standard_module_count: 2,
	standard_todo_count: 3,
	standard_file_count: 4,
}

export interface MethodologyCoverageConfig {
	enabled: boolean
	min_dimensions_simple: number
	min_dimensions_standard: number
	min_dimensions_complex: number
	methodology_warning_threshold: number
	complexity_thresholds: ComplexityThresholds
}

export const DEFAULT_METHODOLOGY_COVERAGE_CONFIG: MethodologyCoverageConfig = {
	enabled: true,
	min_dimensions_simple: 2,
	min_dimensions_standard: 3,
	min_dimensions_complex: 5,
	methodology_warning_threshold: 3,
	complexity_thresholds: DEFAULT_COMPLEXITY_THRESHOLDS,
}

export type MethodologyCoverageReason = "coverage_insufficient" | null

export interface MethodologyCoverageResult {
	shouldBlock: boolean
	reason: MethodologyCoverageReason
	required: number
	actual: number
	deficit: number
	complexity: TaskComplexity
}

export function inferTaskComplexity(
	editedFileCount: number,
	moduleCount: number,
	todoCount: number,
	thresholds: ComplexityThresholds,
): TaskComplexity {
	if (
		moduleCount >= thresholds.complex_module_count
		|| todoCount >= thresholds.complex_todo_count
		|| editedFileCount >= thresholds.complex_file_count
	) return "complex"

	if (
		moduleCount >= thresholds.standard_module_count
		|| todoCount >= thresholds.standard_todo_count
		|| editedFileCount >= thresholds.standard_file_count
	) return "standard"

	return "simple"
}

export function evaluateMethodologyCoverage(
	dimensionsCovered: number,
	complexity: TaskComplexity,
	priorWarnings: number,
	config: MethodologyCoverageConfig,
): MethodologyCoverageResult {
	const base = { complexity, actual: dimensionsCovered }

	if (!config.enabled) {
		return { ...base, shouldBlock: false, reason: null, required: 0, deficit: 0 }
	}

	const requiredMap: Record<TaskComplexity, number> = {
		simple: config.min_dimensions_simple,
		standard: config.min_dimensions_standard,
		complex: config.min_dimensions_complex,
	}
	const required = requiredMap[complexity]
	const deficit = Math.max(0, required - dimensionsCovered)

	if (deficit === 0) {
		return { ...base, shouldBlock: false, reason: null, required, deficit: 0 }
	}

	const shouldBlock = priorWarnings >= config.methodology_warning_threshold
	return { ...base, shouldBlock, reason: "coverage_insufficient", required, deficit }
}
