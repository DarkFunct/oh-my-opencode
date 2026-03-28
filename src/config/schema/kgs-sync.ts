import { z } from "zod"

export const KnowledgeModeSchema = z.enum(["dual", "markdown_only"])
export const KnowledgeReadSourceModeSchema = z.enum(["hybrid", "local_only", "kgs_only"])

export const KGSKnowledgeSyncConfigSchema = z.object({
  mode: KnowledgeModeSchema.optional(),
  read_source_mode: KnowledgeReadSourceModeSchema.optional(),
  read_augment: z.boolean().optional(),
  outbox_replay: z.boolean().optional(),
})

export const KGSTaskMaintenanceSafetyConfigSchema = z.object({
  max_reconcile_per_run: z.number().int().min(1).max(500).optional(),
  max_failures_per_run: z.number().int().min(1).max(500).optional(),
  orphan_grace_ms: z.number().int().min(0).max(86_400_000).optional(),
  max_invalid_file_removals_per_run: z.number().int().min(1).max(500).optional(),
  min_invalid_file_age_ms: z.number().int().min(0).max(86_400_000).optional(),
})

export const KGSSyncConfigSchema = z.object({
  knowledge: KGSKnowledgeSyncConfigSchema.optional(),
  task_maintenance_safety: KGSTaskMaintenanceSafetyConfigSchema.optional(),
})

export type KGSSyncConfig = z.infer<typeof KGSSyncConfigSchema>
export type KGSKnowledgeSyncConfig = z.infer<typeof KGSKnowledgeSyncConfigSchema>
export type KnowledgeMode = z.infer<typeof KnowledgeModeSchema>
export type KnowledgeReadSourceMode = z.infer<typeof KnowledgeReadSourceModeSchema>
