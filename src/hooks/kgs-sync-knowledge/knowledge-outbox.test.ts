declare const require: (name: string) => {
  afterEach: (fn: () => void | Promise<void>) => void
  describe: (name: string, fn: () => void) => void
  expect: (value: unknown) => { toBe: (expected: unknown) => void }
  it: (name: string, fn: () => Promise<void> | void) => void
}

const { afterEach, describe, expect, it } = require("bun:test")

import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { enqueueKnowledgeOutbox, replayKnowledgeOutbox } from "./knowledge-outbox"

describe("knowledge-outbox", () => {
  let tempRoot = ""

  afterEach(() => {
    if (tempRoot.length > 0) {
      rmSync(tempRoot, { recursive: true, force: true })
    }
    tempRoot = ""
  })

  it("replays successful records and keeps failed records", async () => {
    tempRoot = mkdtempSync(path.join(tmpdir(), "kgs-knowledge-outbox-"))

    await enqueueKnowledgeOutbox(tempRoot, {
      documentPath: "_meta/knowledge/pitfalls.md",
      writtenAt: new Date().toISOString(),
    })
    await enqueueKnowledgeOutbox(tempRoot, {
      documentPath: "_meta/knowledge/lessons-learned.md",
      writtenAt: new Date().toISOString(),
    })

    const firstReplay = await replayKnowledgeOutbox(tempRoot, async (record) => {
      return record.documentPath.endsWith("pitfalls.md")
    })

    expect(firstReplay.replayed).toBe(1)
    expect(firstReplay.remaining).toBe(1)

    const secondReplay = await replayKnowledgeOutbox(tempRoot, async () => true)
    expect(secondReplay.replayed).toBe(1)
    expect(secondReplay.remaining).toBe(0)
  })
})
