declare const require: (name: string) => {
  describe: (name: string, fn: () => void) => void
  expect: (value: unknown) => { toBe: (expected: unknown) => void }
  it: (name: string, fn: () => void) => void
}

const { describe, expect, it } = require("bun:test")

import {
  extractFilePathFromArgs,
  extractFilePathFromMetadata,
  isKnowledgeDocumentPath,
  normalizeToolFilePath,
} from "./path-resolution"

describe("path-resolution", () => {
  it("extracts file path from args aliases", () => {
    expect(extractFilePathFromArgs({ filePath: "a.md" })).toBe("a.md")
    expect(extractFilePathFromArgs({ file_path: "b.md" })).toBe("b.md")
    expect(extractFilePathFromArgs({ path: "c.md" })).toBe("c.md")
    expect(extractFilePathFromArgs({ file: "d.md" })).toBe("d.md")
  })

  it("prefers pending path when resolving metadata path", () => {
    const output = { output: "updated x", metadata: { path: "meta.md" } }
    expect(extractFilePathFromMetadata("pending.md", output)).toBe("pending.md")
  })

  it("normalizes absolute path to project-relative posix", () => {
    const projectRoot = "/repo"
    expect(normalizeToolFilePath("/repo/_meta/knowledge/pitfalls.md", projectRoot)).toBe("_meta/knowledge/pitfalls.md")
  })

  it("detects knowledge document path by scope and extension", () => {
    expect(isKnowledgeDocumentPath("_meta/knowledge/pitfalls.md")).toBe(true)
    expect(isKnowledgeDocumentPath("_meta/knowledge/rules.yaml")).toBe(true)
    expect(isKnowledgeDocumentPath("_meta/knowledge/image.png")).toBe(false)
    expect(isKnowledgeDocumentPath("docs/knowledge/pitfalls.md")).toBe(false)
  })
})
