declare const require: (name: string) => any
const { afterEach, beforeEach, describe, expect, test } = require("bun:test")

import type { PluginInput } from "@opencode-ai/plugin"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { clearRuleCache, createKnowledgeProtectionHook } from "./index"

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

describe("createKnowledgeProtectionHook runtime flow", () => {
	let tempDir: string

	beforeEach(() => {
		clearRuleCache()
		tempDir = mkdtempSync(join(tmpdir(), "kp-runtime-flow-"))
	})

	afterEach(() => {
		clearRuleCache()
		rmSync(tempDir, { recursive: true, force: true })
	})

	function writeRulesFile(content: string): void {
		const dir = join(tempDir, "_meta", "knowledge")
		mkdirSync(dir, { recursive: true })
		writeFileSync(join(dir, "pitfall-rules.yaml"), content)
	}

	test("blocks error-severity pitfall and allows warning-severity pitfall", async () => {
		writeRulesFile(`
version: 1
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
  - id: WARN-DOCKER-COMPOSE
    severity: warning
    trigger:
      tools: ["bash"]
      arg: "command"
      pattern: "\\bdocker compose\\b"
    message: "建议使用 docker-compose"
    fix: "替换为 docker-compose"
    ref: "P-014"
`)

		const hook = createKnowledgeProtectionHook({ directory: tempDir } as PluginInput)
		const before = hook["tool.execute.before"]
		if (!before) throw new Error("tool.execute.before hook missing")

		await before(
			{ tool: "bash", sessionID: "ses-runtime", callID: "call-warning" },
			{ args: { command: "docker compose up -d" } },
		)

		await expect(
			before(
				{ tool: "bash", sessionID: "ses-runtime", callID: "call-error" },
				{ args: { command: "npm install", workdir: "/tmp/packages/demo" } },
			),
		).rejects.toThrow("BLOCK-NPM-IN-PACKAGES")
	})

	test("injects knowledge capture directive after bash error then success", async () => {
		writeRulesFile("version: 1\nrules: []\n")

		const hook = createKnowledgeProtectionHook({ directory: tempDir } as PluginInput)
		const after = hook["tool.execute.after"]
		const transform = Reflect.get(hook, "experimental.chat.messages.transform")
		if (!after || typeof transform !== "function") {
			throw new Error("knowledge-protection hook handlers missing")
		}

		await after(
			{ tool: "bash", sessionID: "ses-capture", callID: "call-fail" },
			{ title: "bash", output: "command failed", metadata: { command: "docker compose up", exitCode: 1 } },
		)
		await after(
			{ tool: "bash", sessionID: "ses-capture", callID: "call-success" },
			{ title: "bash", output: "success", metadata: { command: "docker-compose up", exitCode: 0 } },
		)

		const output = {
			messages: [createMockMessage("继续", "ses-capture")],
		}
		await Reflect.apply(transform, undefined, [{}, output])

		expect(output.messages[0].parts).toHaveLength(2)
		const directivePart = output.messages[0].parts[0]
		expect(directivePart.synthetic).toBe(true)
		expect(directivePart.text).toContain("<knowledge-capture-needed>")
		expect(directivePart.text).toContain("错误命令: docker compose up")
		expect(directivePart.text).toContain("成功命令: docker-compose up")

		await Reflect.apply(transform, undefined, [{}, output])
		expect(output.messages[0].parts).toHaveLength(2)
	})
})
