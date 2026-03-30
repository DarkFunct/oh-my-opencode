import { z } from "zod"

export const CognitiveDirectiveBudgetModeSchema = z.enum([
	"priority_prune",
	"legacy_truncate",
])

export const CognitiveGovernanceDirectiveBudgetSchema = z.object({
	enabled: z.boolean().default(true),
	mode: CognitiveDirectiveBudgetModeSchema.default("priority_prune"),
	max_injection_length: z.number().int().min(100).max(2000).default(500),
	append_omission_notice: z.boolean().default(true),
})

export const CognitiveGovernanceMethodologyPhaseTrackerSchema = z.object({
	capture_reminder_threshold: z.number().int().min(1).max(100).default(5),
	execute_without_read_threshold: z.number().int().min(1).max(100).default(3),
	reminder_cooldown_seconds: z.number().int().min(1).max(3600).default(60),
})

export const CognitiveGovernanceMethodologyChainAuditSchema = z.object({
	min_output_length_for_audit: z.number().int().min(1).max(10_000).default(100),
})

export const CognitiveGovernanceTaskLifecycleEnforcerSchema = z.object({
	edit_write_before_task_reminder: z.number().int().min(1).max(100).default(2),
	reminder_cooldown_seconds: z.number().int().min(1).max(3600).default(90),
})

export const CognitiveGovernancePostExecutionVerifierSchema = z.object({
	verification_reminder_interval: z.number().int().min(1).max(200).default(8),
	reminder_cooldown_seconds: z.number().int().min(1).max(3600).default(120),
})

export const CognitiveGovernanceBehavioralGovernanceSchema = z.object({
	ratio_threshold: z.number().min(1).max(20).default(3),
	checkpoint_interval: z.number().int().min(1).max(200).default(15),
	min_bash_samples_for_ratio_gate: z.number().int().min(1).max(200).default(6),
	cognitive_markers_threshold: z.number().int().min(1).max(5).default(3),
})

export const CognitiveGovernancePreFlightGuardSchema = z.object({
	min_read_before_execute: z.number().int().min(1).max(20).default(1),
	grace_window_seconds: z.number().int().min(1).max(3600).default(30),
})

export const CognitiveGovernanceFixLifecycleGateSchema = z.object({
	repeat_fix_threshold: z.number().int().min(1).max(20).default(3),
	same_file_fix_threshold: z.number().int().min(1).max(20).default(2),
	capture_hard_block_threshold: z.number().int().min(1).max(50).default(4),
	execute_activity_threshold: z.number().int().min(1).max(50).default(3),
	f3_block_threshold: z.number().int().min(1).max(50).default(5),
	f2_f4_block_threshold: z.number().int().min(1).max(50).default(3),
})

export const CognitiveGovernanceDocumentationAutoManagementSchema = z.object({
	enabled: z.boolean().default(true),
	docs_root: z.string().trim().min(1).default("docs"),
	registry_file: z.string().trim().min(1).default("docs/README.md"),
	max_report_items: z.number().int().min(1).max(50).default(8),
})

export const CognitiveGovernancePerceptionDefaultsSchema = z.object({
	include_perception_defaults: z.boolean().default(true),
	max_chars_per_file: z.number().int().min(100).max(200_000).default(12_000),
	workspace_root: z.string().trim().min(1).optional(),
})

export const CognitiveGovernanceGateResponseSchema = z.object({
	hard_block_threshold: z.number().int().min(1).max(20).default(3),
	abort_threshold: z.number().int().min(1).max(50).default(5),
})

export const CognitiveGovernanceToolAbortSchema = z.object({
	max_consecutive: z.number().int().min(1).max(20).default(3),
})

export const CognitiveGovernanceWriteSizeGuardSchema = z.object({
	max_lines: z.number().int().min(50).max(1000).default(200),
	enabled: z.boolean().default(true),
})

export const CognitiveGovernanceDeliveryVerificationSchema = z.object({
	enabled: z.boolean().default(true),
	build_commands: z.array(z.string()).default(["bun run build", "npm run build"]),
	dv_warning_threshold: z.number().int().min(1).max(5).default(2),
	stale_build_reminder_interval: z.number().int().min(1).max(20).default(5),
})

export const CognitiveGovernanceDocumentationGovernanceSchema = z.object({
	enabled: z.boolean().default(true),
	public_interface_patterns: z.array(z.string()).default([
		"src/hooks/*/index.ts",
		"src/config/schema/*.ts",
		"**/types.ts",
		"packages/*/src/**",
	]),
	code_without_doc_threshold: z.number().int().min(1).max(10).default(3),
	capture_hard_block: z.boolean().default(true),
})

export const CognitiveGovernanceCausalAnalysisSchema = z.object({
	enabled: z.boolean().default(true),
	ca_trigger_failures: z.number().int().min(1).max(5).default(2),
	ca_required_reads_before_retry: z.number().int().min(1).max(10).default(3),
	include_counterfactual: z.boolean().default(true),
	include_boundary_closure: z.boolean().default(true),
})

export const CognitiveGovernanceSecretScanSchema = z.object({
	enabled: z.boolean().default(true),
	default_patterns_enabled: z.boolean().default(true),
	custom_patterns: z.array(z.object({
		type: z.string(),
		pattern: z.string(),
	})).default([]),
	test_file_patterns: z.array(z.string()).default([
		"**/test/**", "**/*.test.*", "**/mock/**", "**/fixture/**",
	]),
	placeholder_values: z.array(z.string()).default([
		"placeholder", "xxx", "your-key-here", "changeme", "TODO",
	]),
	env_file_patterns: z.array(z.string()).default([
		"**/.env", "**/.env.*",
	]),
})

export const CognitiveGovernanceDangerousCommandSchema = z.object({
	enabled: z.boolean().default(true),
	default_patterns_enabled: z.boolean().default(true),
	custom_patterns: z.array(z.object({
		category: z.string(),
		pattern: z.string(),
		severity: z.enum(["critical", "high"]),
	})).default([]),
	safe_rm_paths: z.array(z.string()).default([
		"dist/", "build/", "node_modules/", ".next/", "coverage/", "tmp/", ".cache/",
	]),
})

export const CognitiveGovernanceComplexityThresholdsSchema = z.object({
	complex_module_count: z.number().int().min(1).default(3),
	complex_todo_count: z.number().int().min(1).default(8),
	complex_file_count: z.number().int().min(1).default(10),
	standard_module_count: z.number().int().min(1).default(2),
	standard_todo_count: z.number().int().min(1).default(3),
	standard_file_count: z.number().int().min(1).default(4),
})

export const CognitiveGovernanceMethodologyCoverageSchema = z.object({
	enabled: z.boolean().default(true),
	min_dimensions_simple: z.number().int().min(1).max(5).default(2),
	min_dimensions_standard: z.number().int().min(1).max(5).default(3),
	min_dimensions_complex: z.number().int().min(1).max(5).default(5),
	methodology_warning_threshold: z.number().int().min(1).max(5).default(3),
	complexity_thresholds: CognitiveGovernanceComplexityThresholdsSchema.default({
		complex_module_count: 3,
		complex_todo_count: 8,
		complex_file_count: 10,
		standard_module_count: 2,
		standard_todo_count: 3,
		standard_file_count: 4,
	}),
})

export const CognitiveGovernanceBatchClassificationSchema = z.object({
	enabled: z.boolean().default(true),
	batch_threshold: z.number().int().min(3).max(20).default(5),
	classification_marker_patterns: z.array(z.string()).default([
		"^\\[.+\\]",
		"^\\(.+\\)",
	]),
})

export const CognitiveGovernanceRetrospectiveSchema = z.object({
	enabled: z.boolean().default(true),
	retrospective_threshold: z.number().int().min(2).max(10).default(4),
	retrospective_priority: z.enum(["critical", "high", "medium"]).default("critical"),
})

export const CognitiveGovernanceConfigSchema = z.object({
	directive_budget: CognitiveGovernanceDirectiveBudgetSchema.optional(),
	methodology_chain_audit: CognitiveGovernanceMethodologyChainAuditSchema.optional(),
	methodology_phase_tracker: CognitiveGovernanceMethodologyPhaseTrackerSchema.optional(),
	task_lifecycle_enforcer: CognitiveGovernanceTaskLifecycleEnforcerSchema.optional(),
	post_execution_verifier: CognitiveGovernancePostExecutionVerifierSchema.optional(),
	behavioral_governance: CognitiveGovernanceBehavioralGovernanceSchema.optional(),
	pre_flight_guard: CognitiveGovernancePreFlightGuardSchema.optional(),
	fix_lifecycle_gate: CognitiveGovernanceFixLifecycleGateSchema.optional(),
	documentation_auto_management: CognitiveGovernanceDocumentationAutoManagementSchema.optional(),
	perception_defaults: CognitiveGovernancePerceptionDefaultsSchema.optional(),
	gate_response: CognitiveGovernanceGateResponseSchema.optional(),
	tool_abort: CognitiveGovernanceToolAbortSchema.optional(),
	write_size_guard: CognitiveGovernanceWriteSizeGuardSchema.optional(),
	delivery_verification: CognitiveGovernanceDeliveryVerificationSchema.optional(),
	documentation_governance: CognitiveGovernanceDocumentationGovernanceSchema.optional(),
	causal_analysis: CognitiveGovernanceCausalAnalysisSchema.optional(),
	secret_scan: CognitiveGovernanceSecretScanSchema.optional(),
	dangerous_command: CognitiveGovernanceDangerousCommandSchema.optional(),
	methodology_coverage: CognitiveGovernanceMethodologyCoverageSchema.optional(),
	batch_classification: CognitiveGovernanceBatchClassificationSchema.optional(),
	retrospective: CognitiveGovernanceRetrospectiveSchema.optional(),
})

export type CognitiveGovernanceConfig = z.infer<typeof CognitiveGovernanceConfigSchema>
export type CognitiveDirectiveBudgetMode = z.infer<typeof CognitiveDirectiveBudgetModeSchema>
