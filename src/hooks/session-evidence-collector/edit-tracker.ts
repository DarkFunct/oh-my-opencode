import type { SessionCognitiveState } from "../cognitive-governance-shared/types"

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
): void {
	if (/exit code 0/i.test(output) || /compiled?\s+successfully/i.test(output) || /build\s+complete/i.test(output)) {
		state.lastBuildResult = "success"
		state.consecutiveFixFailures = 0
	} else if (/exit code [1-9]/i.test(output) || /(?:compilation|type)\s+error/i.test(output) || /tsc.*error\s+TS/i.test(output)) {
		state.lastBuildResult = "fail"
	}
}

export function trackTestResult(
	state: SessionCognitiveState,
	output: string,
): void {
	if (/tests?\s+passed|all\s+pass/i.test(output)) {
		state.lastTestResult = "success"
	} else if (/tests?\s+failed|failure/i.test(output)) {
		state.lastTestResult = "fail"
	}
}
