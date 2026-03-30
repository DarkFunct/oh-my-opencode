import type { SessionCognitiveState } from "../cognitive-governance-shared/types"

const DOC_FILE_PATTERNS = [
	/(?:^|\/)docs\//,
	/(?:^|\/)AGENTS\.md$/i,
	/(?:^|\/)README\.md$/i,
	/(?:^|\/)_meta\/harness\//,
]

const PUBLIC_INTERFACE_RULES: Array<{ pattern: RegExp; changeType: "hook" | "config" | "type" | "api" | "export" }> = [
	{ pattern: /src\/hooks\/[^/]+\/index\.ts$/, changeType: "hook" },
	{ pattern: /src\/config\/schema\/[^/]+\.ts$/, changeType: "config" },
	{ pattern: /\/types\.ts$/, changeType: "type" },
	{ pattern: /packages\/[^/]+\/src\//, changeType: "api" },
	{ pattern: /src\/[^/]+\/index\.ts$/, changeType: "export" },
]

const NON_CODE_EXTENSIONS = new Set([".md", ".mdx", ".txt", ".yaml", ".yml", ".json", ".toml"])

const BUILD_COMMAND_PATTERNS = [
	/\bbun\s+run\s+build\b/i,
	/\bnpm\s+run\s+build\b/i,
	/\bpnpm\s+run\s+build\b/i,
	/\byarn\s+build\b/i,
	/\btsc\b/i,
	/\btypecheck\b/i,
]

const TEST_COMMAND_PATTERNS = [
	/\bbun\s+test\b/i,
	/\bnpm\s+(?:run\s+)?test\b/i,
	/\bvitest\b/i,
	/\bjest\b/i,
	/\bpytest\b/i,
]

const EXIT_CODE_PATTERN = /exit code[:\s]+(\d+)/i

export function isDocFile(filePath: string): boolean {
	return DOC_FILE_PATTERNS.some((p) => p.test(filePath))
}

export function isPublicInterfaceFile(filePath: string): string | null {
	const rule = PUBLIC_INTERFACE_RULES.find((r) => r.pattern.test(filePath))
	return rule?.changeType ?? null
}

export function isBuildCommand(command: string): boolean {
	return BUILD_COMMAND_PATTERNS.some((p) => p.test(command))
}

export function isTestCommand(command: string): boolean {
	return TEST_COMMAND_PATTERNS.some((p) => p.test(command))
}

function isCodeFile(filePath: string): boolean {
	const extStart = filePath.lastIndexOf(".")
	if (extStart < 0) return true
	return !NON_CODE_EXTENSIONS.has(filePath.slice(extStart).toLowerCase())
}

function extractExitCode(output: string): number | null {
	const match = output.match(EXIT_CODE_PATTERN)
	return match ? parseInt(match[1], 10) : null
}

function hasTestFailure(output: string): boolean {
	return /\b[1-9]\d*\s+fail/i.test(output)
}

export function trackDeliveryEvidence(
	state: SessionCognitiveState,
	tool: string,
	args: Record<string, unknown>,
	output: string,
): void {
	const normalized = tool.toLowerCase()
	const filePath = typeof args.filePath === "string" ? args.filePath : typeof args.file_path === "string" ? args.file_path : undefined
	const command = typeof args.command === "string" ? args.command : undefined
	const ev = state.deliveryEvidence

	if ((normalized === "edit" || normalized === "write" || normalized === "ast_grep_replace") && filePath && isCodeFile(filePath)) {
		ev.codeChangesSinceBuild++
		ev.lastCodeChangeTimestamp = Date.now()
		ev.testsSinceCodeChange = false
		return
	}

	if (normalized === "bash" && command) {
		if (isBuildCommand(command)) {
			const exitCode = extractExitCode(output)
			ev.lastBuildTimestamp = Date.now()
			ev.lastBuildCommand = command
			ev.buildExitCode = exitCode
			if (exitCode === 0 || (exitCode === null && !/error/i.test(output))) {
				ev.codeChangesSinceBuild = 0
			}
			return
		}

		if (isTestCommand(command)) {
			ev.lastTestTimestamp = Date.now()
			ev.lastTestResult = hasTestFailure(output) ? "fail" : "pass"
			ev.testsSinceCodeChange = true
			return
		}
	}
}

export function trackDocumentationEvidence(
	state: SessionCognitiveState,
	tool: string,
	args: Record<string, unknown>,
): void {
	const normalized = tool.toLowerCase()
	if (normalized !== "edit" && normalized !== "write" && normalized !== "ast_grep_replace") return

	const filePath = typeof args.filePath === "string" ? args.filePath : typeof args.file_path === "string" ? args.file_path : undefined
	if (!filePath) return

	const docEv = state.documentationEvidence
	const now = Date.now()

	if (isDocFile(filePath)) {
		docEv.docChanges.push({ filePath, timestamp: now })
		docEv.lastDocChangeTimestamp = now
		docEv.codeChangesWithoutDocUpdate = 0
		return
	}

	const changeType = isPublicInterfaceFile(filePath)
	if (changeType) {
		docEv.publicInterfaceChanges.push({
			filePath,
			timestamp: now,
			changeType: changeType as "export" | "config" | "type" | "hook" | "api",
		})
		docEv.codeChangesWithoutDocUpdate++
	}
}
