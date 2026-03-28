declare const require: (name: string) => {
  describe: (name: string, fn: () => void) => void
  expect: (value: unknown) => { toBe: (expected: unknown) => void }
  it: (name: string, fn: () => void) => void
}

const { describe, expect, it } = require("bun:test")

import { resolveKnowledgeMode, resolveKnowledgeRuntimeConfig } from "./knowledge-mode"

describe("knowledge-mode", () => {
  it("defaults to dual mode", () => {
    const env = {}
    expect(resolveKnowledgeMode(env)).toBe("dual")
    const config = resolveKnowledgeRuntimeConfig({ env })
    expect(config.mode).toBe("dual")
    expect(config.readAugmentEnabled).toBe(true)
    expect(config.writeIngestEnabled).toBe(true)
    expect(config.outboxReplayEnabled).toBe(true)
  })

  it("switches to markdown_only mode", () => {
    const config = resolveKnowledgeRuntimeConfig({
      env: {
        KGS_KNOWLEDGE_MODE: "markdown_only",
      },
    })
    expect(config.mode).toBe("markdown_only")
    expect(config.writeIngestEnabled).toBe(false)
  })

  it("supports explicit read/outbox toggles", () => {
    const config = resolveKnowledgeRuntimeConfig({
      env: {
        KGS_KNOWLEDGE_MODE: "dual",
        KGS_KNOWLEDGE_READ_AUGMENT: "false",
        KGS_KNOWLEDGE_OUTBOX_REPLAY: "0",
      },
    })
    expect(config.readAugmentEnabled).toBe(false)
    expect(config.outboxReplayEnabled).toBe(false)
  })

  it("lets explicit config override env toggles", () => {
    const config = resolveKnowledgeRuntimeConfig({
      env: {
        KGS_KNOWLEDGE_MODE: "dual",
        KGS_KNOWLEDGE_READ_AUGMENT: "false",
        KGS_KNOWLEDGE_OUTBOX_REPLAY: "false",
      },
      override: {
        mode: "markdown_only",
        read_augment: true,
        outbox_replay: true,
      },
    })

    expect(config.mode).toBe("markdown_only")
    expect(config.readAugmentEnabled).toBe(true)
    expect(config.outboxReplayEnabled).toBe(true)
    expect(config.writeIngestEnabled).toBe(false)
  })
})
