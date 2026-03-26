import type { PitfallRule, MatchResult } from "./types"
import { extractMatchableArg, extractConditionArg } from "./arg-extractor"

function testPattern(value: string, pattern: string): boolean {
	try {
		return new RegExp(pattern).test(value)
	} catch {
		return false
	}
}

function matchSingleRule(
	rule: PitfallRule,
	tool: string,
	args: Record<string, unknown>,
): MatchResult | null {
	if (!rule.trigger.tools.includes(tool)) {
		return null
	}

	const primaryValue = extractMatchableArg(tool, args, rule.trigger.arg)
	if (!primaryValue) {
		return null
	}

	if (!testPattern(primaryValue, rule.trigger.pattern)) {
		return null
	}

	if (rule.trigger.conditions) {
		for (const condition of rule.trigger.conditions) {
			const condValue = extractConditionArg(args, condition.arg)
			if (!condValue || !testPattern(condValue, condition.pattern)) {
				return null
			}
		}
	}

	return {
		rule,
		matchedArg: rule.trigger.arg,
		matchedValue: primaryValue,
	}
}

export function matchRules(
	rules: readonly PitfallRule[],
	tool: string,
	args: Record<string, unknown>,
): readonly MatchResult[] {
	const results: MatchResult[] = []
	for (const rule of rules) {
		const result = matchSingleRule(rule, tool, args)
		if (result) {
			results.push(result)
		}
	}
	return results
}
