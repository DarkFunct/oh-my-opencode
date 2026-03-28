declare const require: (name: string) => any
const { describe, expect, test } = require("bun:test")
import { classifyRuntimeFallbackReason } from "./runtime-fallback-reason"

describe("classifyRuntimeFallbackReason", () => {
  test("classifies 429 as onRateLimit", () => {
    const reason = classifyRuntimeFallbackReason(
      { statusCode: 429, message: "rate limit exceeded" },
      [429, 500, 502, 503, 504],
    )
    expect(reason).toBe("onRateLimit")
  })

  test("classifies auth failures as onAuthError", () => {
    const reason = classifyRuntimeFallbackReason(
      { statusCode: 401, message: "Unauthorized: invalid API key" },
      [429, 500, 502, 503, 504],
    )
    expect(reason).toBe("onAuthError")
  })

  test("classifies thinking incompatibility as onThinkingIncompatible", () => {
    const reason = classifyRuntimeFallbackReason(
      { message: "reasoning is not supported by this model" },
      [429, 500, 502, 503, 504],
    )
    expect(reason).toBe("onThinkingIncompatible")
  })

  test("classifies model not found as onModelUnavailable", () => {
    const reason = classifyRuntimeFallbackReason(
      {
        name: "ProviderModelNotFoundError",
        data: { message: "Model not found: anthropic/claude-opus-4-6" },
      },
      [429, 500, 502, 503, 504],
    )
    expect(reason).toBe("onModelUnavailable")
  })
})
