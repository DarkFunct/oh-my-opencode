import { describe, expect, test } from "bun:test"
import { matchRules } from "./rule-matcher"
import type { PitfallRule } from "./types"

function makeRule(overrides: Partial<PitfallRule> & { id: string }): PitfallRule {
	return {
		severity: "warning",
		trigger: {
			tools: ["bash"],
			arg: "command",
			pattern: "test",
		},
		message: "Test message",
		fix: "Test fix",
		ref: "TEST",
		...overrides,
	}
}

describe("matchRules", () => {
	test("matches P-014: docker compose → docker-compose", () => {
		const rules = [makeRule({
			id: "P-014",
			trigger: {
				tools: ["bash"],
				arg: "command",
				pattern: "\\bdocker compose\\b",
			},
		})]

		const results = matchRules(rules, "bash", { command: "docker compose up -d" })
		expect(results).toHaveLength(1)
		expect(results[0].rule.id).toBe("P-014")
		expect(results[0].matchedArg).toBe("command")
		expect(results[0].matchedValue).toBe("docker compose up -d")
	})

	test("does not match when tool is different", () => {
		const rules = [makeRule({
			id: "P-014",
			trigger: {
				tools: ["bash"],
				arg: "command",
				pattern: "\\bdocker compose\\b",
			},
		})]

		const results = matchRules(rules, "edit", { command: "docker compose up" })
		expect(results).toHaveLength(0)
	})

	test("does not match when pattern does not match arg value", () => {
		const rules = [makeRule({
			id: "P-014",
			trigger: {
				tools: ["bash"],
				arg: "command",
				pattern: "\\bdocker compose\\b",
			},
		})]

		const results = matchRules(rules, "bash", { command: "docker-compose up -d" })
		expect(results).toHaveLength(0)
	})

	test("matches rule with conditions", () => {
		const rules = [makeRule({
			id: "P-008",
			severity: "error",
			trigger: {
				tools: ["bash"],
				arg: "command",
				pattern: "\\bnpm install\\b",
				conditions: [
					{ arg: "workdir", pattern: "packages/" },
				],
			},
		})]

		const results = matchRules(rules, "bash", {
			command: "npm install",
			workdir: "/Users/hanshu/Data/Gaia/packages/kgs-middleware",
		})
		expect(results).toHaveLength(1)
		expect(results[0].rule.id).toBe("P-008")
	})

	test("does not match when condition fails", () => {
		const rules = [makeRule({
			id: "P-008",
			trigger: {
				tools: ["bash"],
				arg: "command",
				pattern: "\\bnpm install\\b",
				conditions: [
					{ arg: "workdir", pattern: "packages/" },
				],
			},
		})]

		const results = matchRules(rules, "bash", {
			command: "npm install",
			workdir: "/Users/hanshu/Data/Gaia",
		})
		expect(results).toHaveLength(0)
	})

	test("matches multiple rules simultaneously", () => {
		const rules = [
			makeRule({
				id: "CRED-NEO4J",
				trigger: {
					tools: ["bash"],
					arg: "command",
					pattern: "neo4j",
				},
			}),
			makeRule({
				id: "CRED-PG",
				trigger: {
					tools: ["bash"],
					arg: "command",
					pattern: "psql",
				},
			}),
		]

		const results = matchRules(rules, "bash", { command: "neo4j status" })
		expect(results).toHaveLength(1)
		expect(results[0].rule.id).toBe("CRED-NEO4J")
	})

	test("returns empty array when no rules match", () => {
		const rules = [makeRule({
			id: "P-014",
			trigger: {
				tools: ["bash"],
				arg: "command",
				pattern: "\\bdocker compose\\b",
			},
		})]

		const results = matchRules(rules, "bash", { command: "ls -la" })
		expect(results).toHaveLength(0)
	})

	test("handles empty rules array", () => {
		const results = matchRules([], "bash", { command: "anything" })
		expect(results).toHaveLength(0)
	})

	test("handles invalid regex pattern gracefully", () => {
		const rules = [makeRule({
			id: "BAD-REGEX",
			trigger: {
				tools: ["bash"],
				arg: "command",
				pattern: "[invalid(regex",
			},
		})]

		const results = matchRules(rules, "bash", { command: "anything" })
		expect(results).toHaveLength(0)
	})

	test("matches git force push (error severity)", () => {
		const rules = [makeRule({
			id: "GIT-FORCE-PUSH",
			severity: "error",
			trigger: {
				tools: ["bash"],
				arg: "command",
				pattern: "git push.*(--force|-f)\\b",
			},
		})]

		const results = matchRules(rules, "bash", { command: "git push origin main --force" })
		expect(results).toHaveLength(1)
		expect(results[0].rule.severity).toBe("error")
	})

	test("matches OMO-BUN-001: npm in OMO workdir", () => {
		const rules = [makeRule({
			id: "OMO-BUN-001",
			severity: "error",
			trigger: {
				tools: ["bash"],
				arg: "command",
				pattern: "\\b(npm install|npm run|yarn add|yarn run)\\b",
				conditions: [
					{ arg: "workdir", pattern: "oh-my-open(code|agent)" },
				],
			},
		})]

		const results = matchRules(rules, "bash", {
			command: "npm install express",
			workdir: "/Users/hanshu/Data/TukeAI/oh-my-opencode",
		})
		expect(results).toHaveLength(1)
		expect(results[0].rule.id).toBe("OMO-BUN-001")
	})

	test("does not match OMO-BUN-001 in non-OMO workdir", () => {
		const rules = [makeRule({
			id: "OMO-BUN-001",
			severity: "error",
			trigger: {
				tools: ["bash"],
				arg: "command",
				pattern: "\\b(npm install|npm run|yarn add|yarn run)\\b",
				conditions: [
					{ arg: "workdir", pattern: "oh-my-open(code|agent)" },
				],
			},
		})]

		const results = matchRules(rules, "bash", {
			command: "npm install express",
			workdir: "/Users/hanshu/Data/Gaia",
		})
		expect(results).toHaveLength(0)
	})
})
