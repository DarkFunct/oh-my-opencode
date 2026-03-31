import { z } from "zod"

export const KGSGuardConfigSchema = z.object({
	write_debounce_ms: z.number().int().min(1_000).max(60_000).default(10_000),
})

export type KGSGuardConfig = z.infer<typeof KGSGuardConfigSchema>
