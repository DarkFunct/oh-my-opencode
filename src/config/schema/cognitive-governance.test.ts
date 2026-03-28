import { describe, expect, test } from "bun:test"
import { CognitiveGovernanceConfigSchema, OhMyOpenCodeConfigSchema } from "../schema"

describe("cognitive-governance schema", () => {
	test("applies directive budget defaults", () => {
		const result = CognitiveGovernanceConfigSchema.safeParse({
			directive_budget: {},
			methodology_chain_audit: {},
			methodology_phase_tracker: {},
			task_lifecycle_enforcer: {},
			post_execution_verifier: {},
			behavioral_governance: {},
			pre_flight_guard: {},
			fix_lifecycle_gate: {},
			perception_defaults: {},
		})

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.directive_budget?.enabled).toBe(true)
			expect(result.data.directive_budget?.mode).toBe("priority_prune")
			expect(result.data.directive_budget?.max_injection_length).toBe(500)
			expect(result.data.directive_budget?.append_omission_notice).toBe(true)
			expect(result.data.methodology_chain_audit?.min_output_length_for_audit).toBe(100)
			expect(result.data.methodology_phase_tracker?.capture_reminder_threshold).toBe(5)
			expect(result.data.methodology_phase_tracker?.execute_without_read_threshold).toBe(3)
			expect(result.data.methodology_phase_tracker?.reminder_cooldown_seconds).toBe(60)
			expect(result.data.task_lifecycle_enforcer?.edit_write_before_task_reminder).toBe(2)
			expect(result.data.task_lifecycle_enforcer?.reminder_cooldown_seconds).toBe(90)
			expect(result.data.post_execution_verifier?.verification_reminder_interval).toBe(8)
			expect(result.data.post_execution_verifier?.reminder_cooldown_seconds).toBe(120)
			expect(result.data.behavioral_governance?.ratio_threshold).toBe(3)
			expect(result.data.behavioral_governance?.checkpoint_interval).toBe(15)
			expect(result.data.behavioral_governance?.min_bash_samples_for_ratio_gate).toBe(6)
			expect(result.data.behavioral_governance?.cognitive_markers_threshold).toBe(3)
			expect(result.data.pre_flight_guard?.min_read_before_execute).toBe(1)
			expect(result.data.pre_flight_guard?.grace_window_seconds).toBe(30)
			expect(result.data.fix_lifecycle_gate?.repeat_fix_threshold).toBe(3)
			expect(result.data.fix_lifecycle_gate?.same_file_fix_threshold).toBe(2)
			expect(result.data.fix_lifecycle_gate?.capture_hard_block_threshold).toBe(4)
			expect(result.data.fix_lifecycle_gate?.execute_activity_threshold).toBe(3)
			expect(result.data.fix_lifecycle_gate?.f3_block_threshold).toBe(5)
			expect(result.data.fix_lifecycle_gate?.f2_f4_block_threshold).toBe(3)
			expect(result.data.perception_defaults?.include_perception_defaults).toBe(true)
			expect(result.data.perception_defaults?.max_chars_per_file).toBe(12_000)
		}
	})

	test("accepts governance threshold overrides for audit/preflight/fix-lifecycle", () => {
		const result = OhMyOpenCodeConfigSchema.safeParse({
			cognitive_governance: {
				methodology_chain_audit: {
					min_output_length_for_audit: 180,
				},
				behavioral_governance: {
					min_bash_samples_for_ratio_gate: 8,
					cognitive_markers_threshold: 4,
				},
				pre_flight_guard: {
					min_read_before_execute: 2,
					grace_window_seconds: 45,
				},
				fix_lifecycle_gate: {
					repeat_fix_threshold: 4,
					same_file_fix_threshold: 3,
					capture_hard_block_threshold: 6,
					execute_activity_threshold: 5,
					f3_block_threshold: 7,
					f2_f4_block_threshold: 4,
				},
			},
		})

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.cognitive_governance?.methodology_chain_audit?.min_output_length_for_audit).toBe(180)
			expect(result.data.cognitive_governance?.behavioral_governance?.min_bash_samples_for_ratio_gate).toBe(8)
			expect(result.data.cognitive_governance?.behavioral_governance?.cognitive_markers_threshold).toBe(4)
			expect(result.data.cognitive_governance?.pre_flight_guard?.min_read_before_execute).toBe(2)
			expect(result.data.cognitive_governance?.pre_flight_guard?.grace_window_seconds).toBe(45)
			expect(result.data.cognitive_governance?.fix_lifecycle_gate?.repeat_fix_threshold).toBe(4)
			expect(result.data.cognitive_governance?.fix_lifecycle_gate?.same_file_fix_threshold).toBe(3)
			expect(result.data.cognitive_governance?.fix_lifecycle_gate?.capture_hard_block_threshold).toBe(6)
			expect(result.data.cognitive_governance?.fix_lifecycle_gate?.execute_activity_threshold).toBe(5)
			expect(result.data.cognitive_governance?.fix_lifecycle_gate?.f3_block_threshold).toBe(7)
			expect(result.data.cognitive_governance?.fix_lifecycle_gate?.f2_f4_block_threshold).toBe(4)
		}
	})

	test("accepts perception defaults overrides from root config", () => {
		const result = OhMyOpenCodeConfigSchema.safeParse({
			cognitive_governance: {
				perception_defaults: {
					include_perception_defaults: false,
					max_chars_per_file: 4096,
					workspace_root: "/tmp/gaia",
				},
			},
		})

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.cognitive_governance?.perception_defaults?.include_perception_defaults).toBe(false)
			expect(result.data.cognitive_governance?.perception_defaults?.max_chars_per_file).toBe(4096)
			expect(result.data.cognitive_governance?.perception_defaults?.workspace_root).toBe("/tmp/gaia")
		}
	})

	test("accepts 7.6.1 threshold overrides from root config", () => {
		const result = OhMyOpenCodeConfigSchema.safeParse({
			cognitive_governance: {
				methodology_phase_tracker: {
					capture_reminder_threshold: 6,
					execute_without_read_threshold: 4,
					reminder_cooldown_seconds: 80,
				},
				task_lifecycle_enforcer: {
					edit_write_before_task_reminder: 3,
					reminder_cooldown_seconds: 100,
				},
				post_execution_verifier: {
					verification_reminder_interval: 10,
					reminder_cooldown_seconds: 140,
				},
				behavioral_governance: {
					ratio_threshold: 2,
					checkpoint_interval: 12,
				},
			},
		})

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.cognitive_governance?.methodology_phase_tracker?.capture_reminder_threshold).toBe(6)
			expect(result.data.cognitive_governance?.task_lifecycle_enforcer?.edit_write_before_task_reminder).toBe(3)
			expect(result.data.cognitive_governance?.post_execution_verifier?.verification_reminder_interval).toBe(10)
			expect(result.data.cognitive_governance?.behavioral_governance?.checkpoint_interval).toBe(12)
		}
	})

	test("accepts root config with legacy truncate mode", () => {
		const result = OhMyOpenCodeConfigSchema.safeParse({
			cognitive_governance: {
				directive_budget: {
					mode: "legacy_truncate",
					max_injection_length: 320,
					append_omission_notice: false,
				},
			},
		})

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.cognitive_governance?.directive_budget?.mode).toBe("legacy_truncate")
			expect(result.data.cognitive_governance?.directive_budget?.max_injection_length).toBe(320)
			expect(result.data.cognitive_governance?.directive_budget?.append_omission_notice).toBe(false)
		}
	})

	test("rejects invalid directive budget mode", () => {
		const result = OhMyOpenCodeConfigSchema.safeParse({
			cognitive_governance: {
				directive_budget: {
					mode: "invalid_mode",
				},
			},
		})

		expect(result.success).toBe(false)
	})
})
