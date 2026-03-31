import { describe, expect, test } from "bun:test"
import { getGateProtocolInjection, hasGateProtocolInjection } from "./gate-protocol-inject"

describe("gate-protocol-inject", () => {
	test("returns non-empty gate protocol string", () => {
		const result = getGateProtocolInjection()

		expect(result.length).toBeGreaterThan(0)
	})

	test("includes gate-response-protocol markers", () => {
		const result = getGateProtocolInjection()

		expect(result).toContain("<gate-response-protocol>")
		expect(result).toContain("</gate-response-protocol>")
	})

	test("includes English gate instructions", () => {
		const result = getGateProtocolInjection()

		expect(result).toContain("Gate Response Protocol")
		expect(result).toContain("🛑")
	})

	test("hasGateProtocolInjection returns true when marker present", () => {
		const content = "some prefix <gate-response-protocol> some content"

		expect(hasGateProtocolInjection(content)).toBe(true)
	})

	test("hasGateProtocolInjection returns false when marker absent", () => {
		expect(hasGateProtocolInjection("no markers here")).toBe(false)
		expect(hasGateProtocolInjection("")).toBe(false)
	})

	test("getGateProtocolInjection output is detected by hasGateProtocolInjection", () => {
		const injection = getGateProtocolInjection()

		expect(hasGateProtocolInjection(injection)).toBe(true)
	})
})
