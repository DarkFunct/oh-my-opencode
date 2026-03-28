/// <reference types="bun-types/test-globals" />

import { createTaskHealthHook } from "./index"
import * as leaseSync from "../task-lifecycle-enforcer/lease-sync"

describe("task-health hook lease heartbeat", () => {
  test("background_output triggers lease heartbeat", async () => {
    const leaseSpy = vi.spyOn(leaseSync, "syncTaskLeaseSignal").mockResolvedValue(undefined)

    const hook = createTaskHealthHook({ directory: "/tmp/gaia-test" } as any)
    const afterHook = hook["tool.execute.after"]

    await afterHook(
      {
        tool: "background_output",
        sessionID: "ses-main-1",
        callID: "call-1",
      },
      {
        title: "background_output",
        output: '{"task_id":"bg_123"}',
        metadata: {},
      },
    )

    expect(leaseSpy).toHaveBeenCalledTimes(1)
    const payload = leaseSpy.mock.calls[0]?.[0] as {
      directory: string
      sessionID: string
      action: string
    }
    expect(payload.directory).toBe("/tmp/gaia-test")
    expect(payload.sessionID).toBe("ses-main-1")
    expect(payload.action).toBe("heartbeat")
    leaseSpy.mockRestore()
  })
})
