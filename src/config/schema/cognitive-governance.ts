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
})

export type CognitiveGovernanceConfig = z.infer<typeof CognitiveGovernanceConfigSchema>
export type CognitiveDirectiveBudgetMode = z.infer<typeof CognitiveDirectiveBudgetModeSchema>
