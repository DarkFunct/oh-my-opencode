import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { loadRules, clearRuleCache } from "./rule-loader"

describe("loadRules", () => {
	let tempDir: string

	beforeEach(() => {
		clearRuleCache()
		tempDir = mkdtempSync(join(tmpdir(), "kp-test-"))
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

	test("loads valid YAML rules file", () => {
		writeRulesFile(`
version: 1
rules:
  - id: TEST-001
    severity: warning
    trigger:
      tools: ["bash"]
      arg: "command"
      pattern: "\\\\btest\\\\b"
    message: "Test rule"
    fix: "Fix it"
    ref: "TEST-001"
`)
		const rules = loadRules(tempDir)
		expect(rules).toHaveLength(1)
		expect(rules[0].id).toBe("TEST-001")
		expect(rules[0].severity).toBe("warning")
		expect(rules[0].trigger.tools).toEqual(["bash"])
		expect(rules[0].trigger.arg).toBe("command")
	})

	test("returns empty array when file does not exist", () => {
		const rules = loadRules(tempDir)
		expect(rules).toEqual([])
	})

	test("filters out rules with missing required fields", () => {
		writeRulesFile(`
version: 1
rules:
  - id: GOOD-001
    severity: warning
    trigger:
      tools: ["bash"]
      arg: "command"
      pattern: "test"
    message: "Good rule"
    fix: "Fix"
    ref: "GOOD"
  - id: BAD-001
    severity: warning
    trigger:
      tools: "not-an-array"
      arg: "command"
      pattern: "test"
    message: "Bad rule - tools not array"
    fix: "Fix"
    ref: "BAD"
  - severity: error
    trigger:
      tools: ["bash"]
      arg: "command"
      pattern: "test"
    message: "Bad rule - missing id"
    fix: "Fix"
    ref: "BAD2"
`)
		const rules = loadRules(tempDir)
		expect(rules).toHaveLength(1)
		expect(rules[0].id).toBe("GOOD-001")
	})

	test("returns empty array for malformed YAML", () => {
		writeRulesFile("not: valid: yaml: [[[")
		const rules = loadRules(tempDir)
		expect(rules).toEqual([])
	})

	test("returns empty array when rules key is missing", () => {
		writeRulesFile(`
version: 1
data:
  - something: else
`)
		const rules = loadRules(tempDir)
		expect(rules).toEqual([])
	})

	test("caches rules by mtime — same file returns cached", () => {
		writeRulesFile(`
version: 1
rules:
  - id: CACHE-001
    severity: info
    trigger:
      tools: ["bash"]
      arg: "command"
      pattern: "cache"
    message: "Cache test"
    fix: "Fix"
    ref: "CACHE"
`)
		const first = loadRules(tempDir)
		const second = loadRules(tempDir)
		expect(first).toBe(second)
	})

	test("reloads when file mtime changes", () => {
		writeRulesFile(`
version: 1
rules:
  - id: V1
    severity: info
    trigger:
      tools: ["bash"]
      arg: "command"
      pattern: "v1"
    message: "V1"
    fix: "Fix"
    ref: "V1"
`)
		const first = loadRules(tempDir)
		expect(first).toHaveLength(1)
		expect(first[0].id).toBe("V1")

		// Force different mtime by writing new content then setting future mtime
		const filePath = join(tempDir, "_meta", "knowledge", "pitfall-rules.yaml")
		writeFileSync(filePath, `
version: 1
rules:
  - id: V2
    severity: warning
    trigger:
      tools: ["edit"]
      arg: "filePath"
      pattern: "v2"
    message: "V2"
    fix: "Fix"
    ref: "V2"
`)
		const futureTime = new Date(Date.now() + 2000)
		const { utimesSync } = require("node:fs")
		utimesSync(filePath, futureTime, futureTime)
		const second = loadRules(tempDir)
		expect(second).toHaveLength(1)
		expect(second[0].id).toBe("V2")
	})

	test("loads real Gaia pitfall-rules.yaml", () => {
		const gaiaDir = "/Users/hanshu/Data/Gaia"
		const rules = loadRules(gaiaDir)

		if (rules.length === 0) {
			console.log("Skipping real Gaia rules test - file not found")
			return
		}

		expect(rules.length).toBeGreaterThanOrEqual(10)

		const p014 = rules.find((r) => r.id === "P-014")
		expect(p014).toBeDefined()
		expect(p014!.trigger.tools).toContain("bash")
		expect(p014!.trigger.arg).toBe("command")
	})
})
