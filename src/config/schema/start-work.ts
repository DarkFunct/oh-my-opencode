import { z } from "zod"

export const StartWorkConfigSchema = z.object({
  /** Enable auto-commit after each atomic task completion (default: true) */
  auto_commit: z.boolean().default(true),
  governance_precheck_enabled: z.boolean().default(true),
  governance_precheck_url: z.url().optional(),
  governance_precheck_timeout_ms: z.number().int().positive().default(5000),
  governance_runtime_policy_version: z.string().trim().min(1).optional(),
})

export type StartWorkConfig = z.infer<typeof StartWorkConfigSchema>
