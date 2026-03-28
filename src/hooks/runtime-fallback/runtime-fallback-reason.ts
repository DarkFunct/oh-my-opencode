import type { GovernanceRuntimeFallbackReason } from "../shared/governance-runtime-fallback-types"
import {
  extractErrorName,
  extractStatusCode,
  getErrorMessage,
} from "./error-classifier"

const RATE_LIMIT_PATTERNS = [
  /rate\s*limit/i,
  /too\s+many\s+requests/i,
  /quota/i,
  /usage\s+limit/i,
  /cool(?:ing)?\s*down/i,
  /retrying\s+in/i,
  /exhausted\s+your\s+capacity/i,
]

const AUTH_PATTERNS = [
  /api\s*key/i,
  /authentication/i,
  /unauthori[sz]ed/i,
  /permission\s+denied/i,
  /forbidden/i,
  /invalid\s+credentials?/i,
  /token/i,
]

const THINKING_INCOMPATIBLE_PATTERNS = [
  /thinking\s+(?:is\s+)?(?:not\s+supported|unsupported|incompatible)/i,
  /reasoning\s+(?:is\s+)?(?:not\s+supported|unsupported|incompatible)/i,
  /unsupported\s+(?:thinking|reasoning)/i,
  /thinking\s+budget/i,
  /reasoning\s+effort/i,
]

const MODEL_UNAVAILABLE_PATTERNS = [
  /model\s+not\s+found/i,
  /model\s+unavailable/i,
  /provider\s+not\s+found/i,
  /unknown\s+provider/i,
  /service\s+unavailable/i,
  /temporarily\s+unavailable/i,
  /overloaded/i,
]

function matchesAnyPattern(message: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(message))
}

export function classifyRuntimeFallbackReason(
  error: unknown,
  retryOnErrors: number[],
): GovernanceRuntimeFallbackReason | undefined {
  const statusCode = extractStatusCode(error, retryOnErrors)
  const errorName = extractErrorName(error)?.toLowerCase() ?? ""
  const message = getErrorMessage(error)

  if (
    matchesAnyPattern(message, THINKING_INCOMPATIBLE_PATTERNS)
    || errorName.includes("thinking")
    || errorName.includes("reasoning")
  ) {
    return "onThinkingIncompatible"
  }

  if (
    statusCode === 401
    || statusCode === 403
    || errorName.includes("auth")
    || errorName.includes("apikey")
    || matchesAnyPattern(message, AUTH_PATTERNS)
  ) {
    return "onAuthError"
  }

  if (
    statusCode === 429
    || statusCode === 529
    || matchesAnyPattern(message, RATE_LIMIT_PATTERNS)
  ) {
    return "onRateLimit"
  }

  if (
    statusCode === 404
    || statusCode === 500
    || statusCode === 502
    || statusCode === 503
    || statusCode === 504
    || errorName.includes("modelnotfound")
    || errorName.includes("providermodelnotfound")
    || errorName.includes("modelunavailable")
    || matchesAnyPattern(message, MODEL_UNAVAILABLE_PATTERNS)
  ) {
    return "onModelUnavailable"
  }

  return undefined
}
