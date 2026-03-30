import { describe, expect, test } from "bun:test"
import { evaluateSecretGate, type SecretGateResult } from "./secret-gate"
import type { SecretScanResult } from "../session-evidence-collector/secret-scanner"

function makeScanResult(overrides: Partial<SecretScanResult> = {}): SecretScanResult {
	return {
		detected: false,
		patterns: [],
		...overrides,
	}
}

describe("secret-gate", () => {
	test("no block when no secrets detected", () => {
		const result = evaluateSecretGate(makeScanResult())
		expect(result.shouldBlock).toBe(false)
		expect(result.severity).toBeNull()
	})

	test("HARD_BLOCK on Layer A match", () => {
		const scan = makeScanResult({
			detected: true,
			patterns: [
				{ type: "private_key", line: 5, redactedMatch: "----****", layer: "A", isTestFile: false },
			],
		})
		const result = evaluateSecretGate(scan)
		expect(result.shouldBlock).toBe(true)
		expect(result.severity).toBe("critical")
		expect(result.message).toContain("private_key")
	})

	test("HARD_BLOCK on Layer A even in test file", () => {
		const scan = makeScanResult({
			detected: true,
			patterns: [
				{ type: "aws_key", line: 10, redactedMatch: "AKIA****", layer: "A", isTestFile: true },
			],
		})
		const result = evaluateSecretGate(scan)
		expect(result.shouldBlock).toBe(true)
		expect(result.severity).toBe("critical")
	})

	test("HARD_BLOCK on Layer B non-test file", () => {
		const scan = makeScanResult({
			detected: true,
			patterns: [
				{ type: "api_key", line: 3, redactedMatch: "sk-1****", layer: "B", isTestFile: false },
			],
		})
		const result = evaluateSecretGate(scan)
		expect(result.shouldBlock).toBe(true)
		expect(result.severity).toBe("high")
	})

	test("WARNING on Layer B test file", () => {
		const scan = makeScanResult({
			detected: true,
			patterns: [
				{ type: "password", line: 7, redactedMatch: "MySe****", layer: "B", isTestFile: true },
			],
		})
		const result = evaluateSecretGate(scan)
		expect(result.shouldBlock).toBe(false)
		expect(result.severity).toBe("warning")
		expect(result.message).toContain("password")
	})

	test("mixed Layer A + Layer B: blocks due to Layer A", () => {
		const scan = makeScanResult({
			detected: true,
			patterns: [
				{ type: "token", line: 1, redactedMatch: "eyJh****", layer: "B", isTestFile: true },
				{ type: "github_token", line: 5, redactedMatch: "ghp_****", layer: "A", isTestFile: true },
			],
		})
		const result = evaluateSecretGate(scan)
		expect(result.shouldBlock).toBe(true)
		expect(result.severity).toBe("critical")
	})

	test("message includes guidance for env variables", () => {
		const scan = makeScanResult({
			detected: true,
			patterns: [
				{ type: "api_key", line: 3, redactedMatch: "sk-1****", layer: "B", isTestFile: false },
			],
		})
		const result = evaluateSecretGate(scan)
		expect(result.message).toContain("环境变量")
	})
})
