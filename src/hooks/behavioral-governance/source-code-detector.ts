import type { GovernanceConfig } from "./types"

const SSH_WRITE_PATTERNS = [
	/ssh\s+.*\b(sed|awk|perl)\b.*-i/,
	/ssh\s+.*\btee\b/,
	/ssh\s+.*>(?!>)/,
	/ssh\s+.*\bcat\b.*>/,
	/ssh\s+.*\becho\b.*>/,
	/ssh\s+.*\bmv\b/,
	/ssh\s+.*\bcp\b/,
	/ssh\s+.*\brm\b/,
]

export function isProtectedSourcePath(
	filePath: string,
	config: GovernanceConfig,
): boolean {
	return config.protectedPathPatterns.some((pattern) => pattern.test(filePath))
}

export function detectSourceCodeModification(
	tool: string,
	args: Record<string, unknown>,
	config: GovernanceConfig,
): { detected: boolean; filePath?: string; operationType?: string } {
	if (tool === "edit" || tool === "write") {
		const filePath = typeof args.filePath === "string" ? args.filePath : undefined
		if (filePath && isProtectedSourcePath(filePath, config)) {
			return { detected: true, filePath, operationType: tool }
		}
	}

	if (tool.toLowerCase() === "bash") {
		const command = typeof args.command === "string" ? args.command : undefined
		if (!command) return { detected: false }

		for (const pattern of SSH_WRITE_PATTERNS) {
			if (pattern.test(command)) {
				return {
					detected: true,
					filePath: command.slice(0, 120),
					operationType: "ssh-write",
				}
			}
		}
	}

	return { detected: false }
}
