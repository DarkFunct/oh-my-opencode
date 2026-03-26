import { readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import yaml from "js-yaml"
import { log } from "../../shared"
import type { RuleFile, PitfallRule } from "./types"

const RULES_RELATIVE_PATH = "_meta/knowledge/pitfall-rules.yaml"

interface RuleCache {
	rules: readonly PitfallRule[]
	mtime: number
	filePath: string
}

let cache: RuleCache | null = null

function getMtime(filePath: string): number | null {
	try {
		return statSync(filePath).mtimeMs
	} catch {
		return null
	}
}

function parseRuleFile(content: string): readonly PitfallRule[] {
	const parsed = yaml.load(content) as RuleFile | null
	if (!parsed || !Array.isArray(parsed.rules)) {
		return []
	}
	return parsed.rules.filter(
		(r): r is PitfallRule =>
			typeof r.id === "string"
			&& typeof r.trigger === "object"
			&& Array.isArray(r.trigger.tools)
			&& typeof r.trigger.pattern === "string",
	)
}

export function loadRules(workspaceDir: string): readonly PitfallRule[] {
	const filePath = join(workspaceDir, RULES_RELATIVE_PATH)
	const mtime = getMtime(filePath)

	if (mtime === null) {
		return []
	}

	if (cache && cache.filePath === filePath && cache.mtime === mtime) {
		return cache.rules
	}

	try {
		const content = readFileSync(filePath, "utf-8")
		const rules = parseRuleFile(content)
		cache = { rules, mtime, filePath }
		log("[knowledge-protection] Loaded rules", {
			count: rules.length,
			filePath,
		})
		return rules
	} catch (e) {
		log("[knowledge-protection] Failed to load rules", { filePath, error: e })
		return cache?.rules ?? []
	}
}

export function clearRuleCache(): void {
	cache = null
}
