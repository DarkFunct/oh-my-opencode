declare const require: (name: string) => {
  describe: (name: string, fn: () => void) => void
  expect: (value: unknown) => {
    toBe: (expected: unknown) => void
    toBeUndefined: () => void
  }
  test: (name: string, fn: () => void) => void
}

const { describe, expect, test } = require("bun:test")

import { OhMyOpenCodeConfigSchema } from "../schema"

describe("kgs_sync schema", () => {
  test("accepts explicit knowledge sync settings", () => {
    const input = {
      kgs_sync: {
        knowledge: {
          mode: "markdown_only",
          read_augment: false,
          outbox_replay: true,
        },
      },
    }

    const result = OhMyOpenCodeConfigSchema.safeParse(input)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.kgs_sync?.knowledge?.mode).toBe("markdown_only")
      expect(result.data.kgs_sync?.knowledge?.read_augment).toBe(false)
      expect(result.data.kgs_sync?.knowledge?.outbox_replay).toBe(true)
    }
  })

  test("rejects invalid knowledge mode", () => {
    const input = {
      kgs_sync: {
        knowledge: {
          mode: "invalid",
        },
      },
    }

    const result = OhMyOpenCodeConfigSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  test("keeps kgs_sync optional", () => {
    const result = OhMyOpenCodeConfigSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.kgs_sync).toBeUndefined()
    }
  })
})
