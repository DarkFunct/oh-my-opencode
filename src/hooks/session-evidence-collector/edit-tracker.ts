import type { SessionCognitiveState } from "../cognitive-governance-shared/types"

export type VerificationSignal = "success" | "fail" | "unknown"

export function trackFileEdit(
	state: SessionCognitiveState,
	filePath: string,
	tool: string,
): void {
	const existing = state.fileEditHistory.get(filePath)
	if (existing) {
		existing.count++
		existing.lastEditTimestamp = Date.now()
		if (!existing.tools.includes(tool)) {
			existing.tools.push(tool)
		}
	} else {
		state.fileEditHistory.set(filePath, {
			count: 1,
			lastEditTimestamp: Date.now(),
			tools: [tool],
		})
	}
}

export function trackReadFile(
	state: SessionCognitiveState,
	filePath: string,
): void {
	state.readFiles.add(filePath)
	state.readCount++
}

export function trackBuildResult(
	state: SessionCognitiveState,
	output: string,
): VerificationSignal {
	if (
		/exit code [1-9]/i.test(output) ||
		/(?:compilation|type)\s+error/i.test(output) ||
		/tsc.*error\s+TS/i.test(output) ||
		/error\s+TS\d+/i.test(output)
	) {
		state.lastBuildResult = "fail"
		return "fail"
	}

	if (
		/exit code 0/i.test(output) ||
		/compiled?\s+successfully/i.test(output) ||
		/build\s+complete/i.test(output) ||
		/\bBundled\s+\d+\s+modules?\b/i.test(output) ||
		/\$\s*tsc\s+--noEmit/i.test(output)
	) {
		state.lastBuildResult = "success"
		state.consecutiveFixFailures = 0
		return "success"
	}

	return "unknown"
}

export function trackTestResult(
	state: SessionCognitiveState,
	output: string,
): VerificationSignal {
	const failCount = extractCount(output, /\b(\d+)\s+fail(?:ed|ures?)?\b/i)
	if (typeof failCount === "number") {
		state.lastTestResult = failCount === 0 ? "success" : "fail"
		return state.lastTestResult
	}

	if (/tests?\s+failed|failed\s+tests?|\bfailure\b/i.test(output)) {
		state.lastTestResult = "fail"
		return "fail"
	}

	if (/tests?\s+passed|all\s+pass|\b\d+\s+pass(?:ed)?\b/i.test(output)) {
		state.lastTestResult = "success"
		return "success"
	}

	return "unknown"
}

function extractCount(output: string, pattern: RegExp): number | undefined {
	const match = output.match(pattern)
	if (!match) return undefined
	const value = Number.parseInt(match[1], 10)
	return Number.isNaN(value) ? undefined : value
}
