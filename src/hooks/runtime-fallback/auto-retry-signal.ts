export interface AutoRetrySignal {
  signal: string
}

export const AUTO_RETRY_PATTERNS: Array<(combined: string) => boolean> = [
  (combined) => /retrying\s+in/i.test(combined),
  (combined) =>
    /(?:too\s+many\s+requests|quota\s*exceeded|quota\s+will\s+reset\s+after|usage\s+limit|rate\s+limit|limit\s+reached|all\s+credentials\s+for\s+model|cool(?:ing)?\s*down|exhausted\s+your\s+capacity)/i.test(combined),
]

export function extractAutoRetrySignal(info: Record<string, unknown> | undefined): AutoRetrySignal | undefined {
  if (!info) return undefined

  const candidates: string[] = []

  const directStatus = info.status
  if (typeof directStatus === "string") candidates.push(directStatus)

  const summary = info.summary
  if (typeof summary === "string") candidates.push(summary)

  const message = info.message
  if (typeof message === "string") candidates.push(message)

  const details = info.details
  if (typeof details === "string") candidates.push(details)

  const combined = candidates.join("\n")
  if (!combined) return undefined

  const isAutoRetry = AUTO_RETRY_PATTERNS.every((test) => test(combined))
  if (isAutoRetry) {
    return { signal: combined }
  }

  return undefined
}

export function containsErrorContent(
  parts: Array<{ type?: string; text?: string }> | undefined,
): { hasError: boolean; errorMessage?: string } {
  if (!parts || parts.length === 0) return { hasError: false }

  const errorParts = parts.filter((p) => p.type === "error")
  if (errorParts.length > 0) {
    const errorMessages = errorParts.map((p) => p.text).filter((text): text is string => typeof text === "string")
    const errorMessage = errorMessages.length > 0 ? errorMessages.join("\n") : undefined
    return { hasError: true, errorMessage }
  }

  return { hasError: false }
}
