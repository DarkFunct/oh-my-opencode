declare const require: (name: string) => {
  describe: (name: string, fn: () => void) => void
  expect: (value: unknown) => {
    toEqual: (expected: unknown) => void
    toBe: (expected: unknown) => void
  }
  it: (name: string, fn: () => Promise<void> | void) => void
}

const { describe, expect, it } = require("bun:test")
import { createToolExecuteAfterHandler } from "./tool-execute-after"

describe("createToolExecuteAfterHandler", () => {
  it("#given truncator changes output #when tool.execute.after runs #then claudeCodeHooks receives truncated output", async () => {
    const callOrder: string[] = []
    let claudeSawOutput = ""

    const handler = createToolExecuteAfterHandler({
      ctx: { directory: "/repo" } as never,
      hooks: {
        toolOutputTruncator: {
          "tool.execute.after": async (_input: unknown, output: { output: string }) => {
            callOrder.push("truncator")
            output.output = "truncated output"
          },
        },
        claudeCodeHooks: {
          "tool.execute.after": async (_input: unknown, output: { output: string }) => {
            callOrder.push("claude")
            claudeSawOutput = output.output
          },
        },
      } as never,
    })

    await handler(
      { tool: "hashline_edit", sessionID: "ses_test", callID: "call_test" },
      { title: "result", output: "original output", metadata: {} }
    )

    expect(callOrder).toEqual(["truncator", "claude"])
    expect(claudeSawOutput).toBe("truncated output")
  })

  it("#given read output is hashline enhanced #when tool.execute.after runs #then kgsSync receives enhanced output", async () => {
    const callOrder: string[] = []
    let kgsSyncSawOutput = ""

    const handler = createToolExecuteAfterHandler({
      ctx: { directory: "/repo" } as never,
      hooks: {
        hashlineReadEnhancer: {
          "tool.execute.after": async (_input: unknown, output: { output: string }) => {
            callOrder.push("hashline")
            output.output = "1#abc12345|hello"
          },
        },
        kgsSync: {
          "tool.execute.after": async (_input: unknown, output: { output: string }) => {
            callOrder.push("kgs-sync")
            kgsSyncSawOutput = output.output
          },
        },
      } as never,
    })

    await handler(
      { tool: "Read", sessionID: "ses_test", callID: "call_test" },
      { title: "result", output: "1: hello", metadata: { path: "_meta/knowledge/pitfalls.md" } },
    )

    expect(callOrder).toEqual(["hashline", "kgs-sync"])
    expect(kgsSyncSawOutput).toBe("1#abc12345|hello")
  })
})
