declare const require: (name: string) => {
  describe: (name: string, fn: () => void) => void
  expect: (value: unknown) => { toBe: (expected: unknown) => void }
  it: (name: string, fn: () => void) => void
}

const { describe, expect, it } = require("bun:test")

import { extractReadText } from "./read-output-parser"

describe("read-output-parser", () => {
  it("extracts plain text from colon read output", () => {
    const output = ["1: alpha", "2: beta"].join("\n")
    expect(extractReadText(output)).toBe("alpha\nbeta")
  })

  it("extracts plain text from hashline output", () => {
    const output = ["1#abc12345|alpha", "2#def67890|beta"].join("\n")
    expect(extractReadText(output)).toBe("alpha\nbeta")
  })

  it("falls back to original output for non-read text", () => {
    const output = "not line-prefixed output"
    expect(extractReadText(output)).toBe(output)
  })
})
