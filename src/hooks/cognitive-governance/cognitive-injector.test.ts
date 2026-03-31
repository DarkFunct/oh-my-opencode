import { describe, expect, test } from "bun:test"
import type { Part } from "@opencode-ai/sdk"
import { composeDirectiveWithinBudget, injectCognitiveDirective } from "./cognitive-injector"

function textPart(text: string): Part {
	return {
		type: "text",
		text,
	} as unknown as Part
}

describe("cognitive-injector", () => {
	test("composes directive by priority before truncation", () => {
		const directive = [
			"[Harness Cognitive Governance — Current State]",
			"Cognitive layer: Understanding Layer",
			"Methodology coverage: technical, empirical",
			"",
			"📝 Capture Reminder",
			"Low priority reminder",
			"",
			"🚨 **Capture Phase CRITICALLY Overdue — Block Imminent**",
			"High priority block action",
			"",
			"[Stage B Cognitive Review Request]",
			"Output structured review conclusion",
		].join("\n")

		const result = composeDirectiveWithinBudget(directive, 220)

		expect(result.length).toBeLessThanOrEqual(220)
		expect(result).toContain("🚨 **Capture Phase CRITICALLY Overdue — Block Imminent**")
		expect(result).not.toContain("📝 Capture Reminder")
	})

	test("injects synthetic directive before last user text part", () => {
		const messages = [
			{
				info: { id: "msg_user_1", role: "user", sessionID: "ses_1" },
				parts: [textPart("继续")],
			},
		]

		const ok = injectCognitiveDirective(messages, "ses_1", "[Harness]\n\n📋 Verification Reminder", 120)

		expect(ok).toBe(true)
		expect(messages[0].parts.length).toBe(2)
		expect((messages[0].parts[0] as { synthetic?: boolean }).synthetic).toBe(true)
		expect((messages[0].parts[0] as { text?: string }).text).toContain("[Harness]")
	})

	test("truncates oversized single block with ellipsis", () => {
		const directive = "X".repeat(120)
		const result = composeDirectiveWithinBudget(directive, 40)

		expect(result.length).toBeLessThanOrEqual(40)
		expect(result.endsWith("...")).toBe(true)
	})

	test("can disable omission notice for priority pruning mode", () => {
		const directive = [
			"[Harness Cognitive Governance — Current State]",
			"Cognitive layer: Understanding Layer",
			"",
			"📝 Capture Reminder",
			"Low priority reminder",
			"",
			"🚨 **Capture Phase CRITICALLY Overdue — Block Imminent**",
			"High priority block action",
		].join("\n")

		const result = composeDirectiveWithinBudget(directive, 120, false)

		expect(result.endsWith("...")).toBe(false)
	})

	test("supports legacy truncate mode via injection config", () => {
		const directive = [
			"[Harness Cognitive Governance — Current State]",
			"Cognitive layer: Understanding Layer",
			"",
			"📝 Capture Reminder",
			"Low priority reminder",
			"",
			"🚨 **Capture Phase CRITICALLY Overdue — Block Imminent**",
			"High priority block action",
		].join("\n")

		const priorityMessages = [
			{ info: { id: "msg_user_2", role: "user", sessionID: "ses_2" }, parts: [textPart("继续")] },
		]
		const legacyMessages = [
			{ info: { id: "msg_user_3", role: "user", sessionID: "ses_3" }, parts: [textPart("继续")] },
		]

		injectCognitiveDirective(priorityMessages, "ses_2", directive, 180, { mode: "priority_prune" })
		injectCognitiveDirective(legacyMessages, "ses_3", directive, 180, { mode: "legacy_truncate" })

		const priorityText = (priorityMessages[0].parts[0] as { text?: string }).text ?? ""
		const legacyText = (legacyMessages[0].parts[0] as { text?: string }).text ?? ""

		expect(priorityText).toContain("🚨 **Capture Phase CRITICALLY Overdue — Block Imminent**")
		expect(legacyText).toContain("📝 Capture Reminder")
	})

	test("keeps full directive when budget is disabled", () => {
		const directive = `${"A".repeat(320)}\n\n${"B".repeat(320)}`
		const messages = [
			{ info: { id: "msg_user_4", role: "user", sessionID: "ses_4" }, parts: [textPart("继续")] },
		]

		injectCognitiveDirective(messages, "ses_4", directive, undefined)
		const injected = (messages[0].parts[0] as { text?: string }).text ?? ""

		expect(injected.length).toBeGreaterThan(500)
		expect(injected).toBe(directive)
	})
})
