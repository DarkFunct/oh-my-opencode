import { z } from "zod"

export const KnowledgeModeSchema = z.enum(["dual", "markdown_only"])

export const KGSKnowledgeSyncConfigSchema = z.object({
  mode: KnowledgeModeSchema.optional(),
  read_augment: z.boolean().optional(),
  outbox_replay: z.boolean().optional(),
})

export const KGSSyncConfigSchema = z.object({
  knowledge: KGSKnowledgeSyncConfigSchema.optional(),
})

export type KGSSyncConfig = z.infer<typeof KGSSyncConfigSchema>
export type KGSKnowledgeSyncConfig = z.infer<typeof KGSKnowledgeSyncConfigSchema>
export type KnowledgeMode = z.infer<typeof KnowledgeModeSchema>
