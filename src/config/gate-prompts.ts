/**
 * Centralized gate prompt templates — English text with Chinese annotations.
 *
 * All gate/governance messages consumed by hooks MUST be sourced from this file.
 * This is the PRESENTATION LAYER (OMO). Detection configs stay in Gaia (C-05).
 *
 * Design: forceful tone, actionable info, example formats per user requirement.
 */

export { GATE_PROMPT } from "./gate-prompts/blocking-gate-prompts"
export { SOFT_PROMPT } from "./gate-prompts/soft-gate-prompts"
export { INJECTION_PROMPT } from "./gate-prompts/injection-prompts"
export { REMEDIATION, type RemediationActionEN, type RemediationMapEN } from "./gate-prompts/remediation-prompts"
