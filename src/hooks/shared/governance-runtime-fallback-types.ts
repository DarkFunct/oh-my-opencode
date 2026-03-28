export const governanceRuntimeFallbackReasons = [
  "onRateLimit",
  "onAuthError",
  "onThinkingIncompatible",
  "onModelUnavailable",
] as const

export type GovernanceRuntimeFallbackReason =
  (typeof governanceRuntimeFallbackReasons)[number]
