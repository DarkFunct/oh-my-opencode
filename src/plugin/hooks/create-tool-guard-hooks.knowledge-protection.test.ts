declare const require: (name: string) => any
const { afterEach, beforeEach, describe, expect, test } = require("bun:test")

import type { OhMyOpenCodeConfig } from "../../config"
import type { ModelCacheState } from "../../plugin-state"
import type { PluginContext } from "../types"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createToolGuardHooks } from "./create-tool-guard-hooks"

type MockTextPart = {
	id: string
	sessionID: string
	messageID: string
	type: "text"
	text: string
	synthetic?: boolean
}

type MockMessage = {
	info: {
		id: string
		sessionID: string
		role: "user"
		time: { created: number }
		agent: string
		model: { providerID: string; modelID: string }
		path: { cwd: string; root: string }
	}
	parts: MockTextPart[]
}

function createMockMessage(text: string, sessionID: string): MockMessage {
	const messageID = `msg_${Date.now()}_${Math.random()}`
	return {
		info: {
			id: messageID,
			sessionID,
			role: "user",
			time: { created: Date.now() },
			agent: "sisyphus",
			model: { providerID: "test", modelID: "test" },
			path: { cwd: "/", root: "/" },
		},
		parts: [
			{
				id: `part_${Date.now()}`,
				sessionID,
				messageID,
				type: "text",
				text,
			},
		],
	}
}

describe("createToolGuardHooks knowledge-protection runtime registration", () => {
	let tempDir: string

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "kp-registration-flow-"))
		const rulesDir = join(tempDir, "_meta", "knowledge")
		mkdirSync(rulesDir, { recursive: true })
		writeFileSync(
			join(rulesDir, "pitfall-rules.yaml"),
			`version: 1
rules:
  - id: BLOCK-NPM-IN-PACKAGES
    severity: error
    trigger:
      tools: ["bash"]
      arg: "command"
      pattern: "npm install"
      conditions:
        - arg: "workdir"
          pattern: "packages/"
    message: "禁止在 workspace 子目录执行 npm install"
    fix: "请在 workspace 根目录执行 npm install"
    ref: "P-008"
`,
		)
	})

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true })
	})

	test("registers hook and preserves runtime before/after/transform behavior", async () => {
		const ctx = {
			directory: tempDir,
			client: {
				tui: { showToast: async () => ({}) },
				session: {
					get: async () => ({ data: null }),
					update: async () => ({}),
				},
			},
		} as unknown as PluginContext

		const hooks = createToolGuardHooks({
			ctx,
			pluginConfig: {} as OhMyOpenCodeConfig,
			modelCacheState: {} as ModelCacheState,
			isHookEnabled: (hookName) => hookName === "knowledge-protection",
			safeHookEnabled: true,
		})

		expect(hooks.knowledgeProtection).not.toBeNull()
		const kp = hooks.knowledgeProtection
		if (!kp) throw new Error("knowledge-protection hook not registered")

		const before = kp["tool.execute.before"]
		const after = kp["tool.execute.after"]
		const transform = Reflect.get(kp, "experimental.chat.messages.transform")
		if (!before || !after || typeof transform !== "function") {
			throw new Error("knowledge-protection handlers missing")
		}

		await expect(
			before(
				{ tool: "bash", sessionID: "ses-reg", callID: "call-block" },
				{ args: { command: "npm install", workdir: "/tmp/packages/demo" } },
			),
		).rejects.toThrow("BLOCK-NPM-IN-PACKAGES")

		await after(
			{ tool: "bash", sessionID: "ses-reg", callID: "call-fail" },
			{ title: "bash", output: "failed", metadata: { command: "docker compose up", exitCode: 1 } },
		)
		await after(
			{ tool: "bash", sessionID: "ses-reg", callID: "call-success" },
			{ title: "bash", output: "ok", metadata: { command: "docker-compose up", exitCode: 0 } },
		)

		const output = { messages: [createMockMessage("继续", "ses-reg")] }
		await Reflect.apply(transform, undefined, [{}, output])

		expect(output.messages[0].parts).toHaveLength(2)
		expect(output.messages[0].parts[0].text).toContain("<knowledge-capture-needed>")
	})
})
