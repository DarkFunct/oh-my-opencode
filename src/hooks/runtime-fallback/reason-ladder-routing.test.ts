declare const require: (name: string) => any
const { afterEach, describe, expect, test } = require("bun:test")
import type { OhMyOpenCodeConfig, RuntimeFallbackConfig } from "../../config"
import {
  _resetGovernanceSessionValidationForTesting,
  getGovernanceRuntimeFallbackState,
} from "../shared/governance-session-state"
import { createRuntimeFallbackHook } from "./hook"

const runtimeConfig: RuntimeFallbackConfig = {
  enabled: true,
  retry_on_errors: [429, 500, 502, 503, 504],
  max_fallback_attempts: 3,
  cooldown_seconds: 60,
  timeout_seconds: 30,
  notify_on_fallback: false,
}

function createContext(promptCalls: Array<{ providerID: string; modelID: string }>) {
  return {
    client: {
      tui: {
        showToast: async () => ({}),
      },
      session: {
        abort: async () => ({}),
        messages: async () => ({
          data: [{ info: { role: "user" }, parts: [{ type: "text", text: "continue" }] }],
        }),
        promptAsync: async (input: unknown) => {
          const model = (input as { body?: { model?: { providerID?: string; modelID?: string } } })?.body?.model
          if (model?.providerID && model?.modelID) {
            promptCalls.push({ providerID: model.providerID, modelID: model.modelID })
          }
          return {}
        },
      },
    },
    directory: "/tmp",
  } as const
}

afterEach(() => {
  _resetGovernanceSessionValidationForTesting()
})

describe("runtime-fallback reason ladder routing", () => {
  test("routes 429 errors to onRateLimit ladder and writes runtime state", async () => {
    const sessionID = "ses-rate-limit-ladder"
    const promptCalls: Array<{ providerID: string; modelID: string }> = []
    const pluginConfig: OhMyOpenCodeConfig = {
      runtime_fallback: {
        enabled: true,
        ladders: {
          onRateLimit: ["openai/gpt-5.2"],
        },
      },
    }

    const hook = createRuntimeFallbackHook(createContext(promptCalls) as never, {
      config: runtimeConfig,
      pluginConfig,
    })

    await hook.event({
      event: {
        type: "session.created",
        properties: { info: { id: sessionID, model: "anthropic/claude-opus-4-6" } },
      },
    })

    await hook.event({
      event: {
        type: "session.error",
        properties: {
          sessionID,
          error: { statusCode: 429, message: "rate limit exceeded" },
        },
      },
    })

    expect(promptCalls[0]).toEqual({ providerID: "openai", modelID: "gpt-5.2" })
    expect(getGovernanceRuntimeFallbackState(sessionID)).toMatchObject({
      reason: "onRateLimit",
      selectedFallbackModel: "openai/gpt-5.2",
      source: "session.error",
    })
  })

  test("routes auth errors to onAuthError ladder", async () => {
    const sessionID = "ses-auth-ladder"
    const promptCalls: Array<{ providerID: string; modelID: string }> = []
    const pluginConfig: OhMyOpenCodeConfig = {
      runtime_fallback: {
        enabled: true,
        ladders: {
          onAuthError: ["google/gemini-2.5-pro"],
        },
      },
    }

    const hook = createRuntimeFallbackHook(createContext(promptCalls) as never, {
      config: runtimeConfig,
      pluginConfig,
    })

    await hook.event({
      event: {
        type: "session.created",
        properties: { info: { id: sessionID, model: "anthropic/claude-opus-4-6" } },
      },
    })

    await hook.event({
      event: {
        type: "session.error",
        properties: {
          sessionID,
          error: { statusCode: 401, message: "Unauthorized API key" },
        },
      },
    })

    expect(promptCalls[0]).toEqual({ providerID: "google", modelID: "gemini-2.5-pro" })
    expect(getGovernanceRuntimeFallbackState(sessionID)).toMatchObject({
      reason: "onAuthError",
      selectedFallbackModel: "google/gemini-2.5-pro",
      source: "session.error",
    })
  })

  test("routes thinking-incompatible errors to onThinkingIncompatible ladder", async () => {
    const sessionID = "ses-thinking-ladder"
    const promptCalls: Array<{ providerID: string; modelID: string }> = []
    const pluginConfig: OhMyOpenCodeConfig = {
      runtime_fallback: {
        enabled: true,
        ladders: {
          onThinkingIncompatible: ["openai/o3"],
        },
      },
    }

    const hook = createRuntimeFallbackHook(createContext(promptCalls) as never, {
      config: runtimeConfig,
      pluginConfig,
    })

    await hook.event({
      event: {
        type: "session.created",
        properties: { info: { id: sessionID, model: "anthropic/claude-opus-4-6" } },
      },
    })

    await hook.event({
      event: {
        type: "session.error",
        properties: {
          sessionID,
          error: { message: "thinking is not supported by this model" },
        },
      },
    })

    expect(promptCalls[0]).toEqual({ providerID: "openai", modelID: "o3" })
    expect(getGovernanceRuntimeFallbackState(sessionID)).toMatchObject({
      reason: "onThinkingIncompatible",
      selectedFallbackModel: "openai/o3",
      source: "session.error",
    })
  })

  test("routes model-unavailable errors to onModelUnavailable ladder", async () => {
    const sessionID = "ses-model-unavailable-ladder"
    const promptCalls: Array<{ providerID: string; modelID: string }> = []
    const pluginConfig: OhMyOpenCodeConfig = {
      runtime_fallback: {
        enabled: true,
        ladders: {
          onModelUnavailable: ["google/gemini-2.5-pro"],
        },
      },
    }

    const hook = createRuntimeFallbackHook(createContext(promptCalls) as never, {
      config: runtimeConfig,
      pluginConfig,
    })

    await hook.event({
      event: {
        type: "session.created",
        properties: { info: { id: sessionID, model: "anthropic/claude-opus-4-6" } },
      },
    })

    await hook.event({
      event: {
        type: "session.error",
        properties: {
          sessionID,
          error: {
            name: "ProviderModelNotFoundError",
            data: { message: "Model not found: anthropic/claude-opus-4-6" },
          },
        },
      },
    })

    expect(promptCalls[0]).toEqual({ providerID: "google", modelID: "gemini-2.5-pro" })
    expect(getGovernanceRuntimeFallbackState(sessionID)).toMatchObject({
      reason: "onModelUnavailable",
      selectedFallbackModel: "google/gemini-2.5-pro",
      source: "session.error",
    })
  })
})
