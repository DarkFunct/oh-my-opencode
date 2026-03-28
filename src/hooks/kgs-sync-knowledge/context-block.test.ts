declare const require: (name: string) => {
  describe: (name: string, fn: () => void) => void
  expect: (value: unknown) => { toContain: (expected: string) => void }
  it: (name: string, fn: () => void) => void
}

const { describe, expect, it } = require("bun:test")

import { formatKnowledgeContextBlock } from "./context-block"

describe("context-block", () => {
  it("formats retrieval response into kgs_context block", () => {
    const block = formatKnowledgeContextBlock({
      ok: true,
      documentPath: "_meta/knowledge/pitfalls.md",
      extractedKeywords: ["kgs", "pitfall"],
      matchedEntities: [
        {
          id: "e-1",
          type: "File",
          fqn: "_meta/knowledge/pitfalls.md",
          path: "_meta/knowledge/pitfalls.md",
          confidence: 1,
          matchReason: "path",
        },
      ],
      bundles: [],
      summary: {
        totalEntities: 1,
        totalRelationships: 2,
        riskHints: ["none"],
      },
      warnings: [],
      data_as_of: new Date().toISOString(),
    })

    expect(block).toContain("<kgs_context>")
    expect(block).toContain("document: _meta/knowledge/pitfalls.md")
    expect(block).toContain("relationships: 2")
    expect(block).toContain("entities:")
    expect(block).toContain("</kgs_context>")
  })
})
