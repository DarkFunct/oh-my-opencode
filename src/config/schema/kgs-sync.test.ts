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
          read_source_mode: "hybrid",
          read_augment: false,
          outbox_replay: true,
        },
        task_maintenance_safety: {
          max_reconcile_per_run: 40,
          max_failures_per_run: 5,
          orphan_grace_ms: 240000,
          max_invalid_file_removals_per_run: 20,
          min_invalid_file_age_ms: 600000,
        },
      },
    }

    const result = OhMyOpenCodeConfigSchema.safeParse(input)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.kgs_sync?.knowledge?.mode).toBe("markdown_only")
      expect(result.data.kgs_sync?.knowledge?.read_source_mode).toBe("hybrid")
      expect(result.data.kgs_sync?.knowledge?.read_augment).toBe(false)
      expect(result.data.kgs_sync?.knowledge?.outbox_replay).toBe(true)
      expect(result.data.kgs_sync?.task_maintenance_safety?.max_reconcile_per_run).toBe(40)
      expect(result.data.kgs_sync?.task_maintenance_safety?.max_failures_per_run).toBe(5)
      expect(result.data.kgs_sync?.task_maintenance_safety?.orphan_grace_ms).toBe(240000)
      expect(result.data.kgs_sync?.task_maintenance_safety?.max_invalid_file_removals_per_run).toBe(20)
      expect(result.data.kgs_sync?.task_maintenance_safety?.min_invalid_file_age_ms).toBe(600000)
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

  test("rejects invalid read source mode", () => {
    const input = {
      kgs_sync: {
        knowledge: {
          read_source_mode: "invalid",
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
