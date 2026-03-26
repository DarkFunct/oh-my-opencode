import type { ProtectionState, BashErrorRecord } from "./types"
import { log } from "../../shared"

const MAX_ERROR_HISTORY = 5
const ERROR_WINDOW_MS = 5 * 60 * 1000

function extractExitCode(output: string, metadata: Record<string, unknown>): number | null {
	if (typeof metadata.exitCode === "number") return metadata.exitCode

	const match = output.match(/exit code:\s*(\d+)/i)
		?? output.match(/exited with code\s+(\d+)/i)
	return match ? parseInt(match[1], 10) : null
}

function pruneOldErrors(errors: BashErrorRecord[]): BashErrorRecord[] {
	const cutoff = Date.now() - ERROR_WINDOW_MS
	return errors.filter((e) => e.timestamp > cutoff)
}

export function trackBashResult(
	state: ProtectionState,
	command: string,
	output: string,
	metadata: Record<string, unknown>,
): void {
	const exitCode = extractExitCode(output, metadata)
	if (exitCode === null) return

	state.lastBashErrors = pruneOldErrors(state.lastBashErrors)

	if (exitCode !== 0) {
		state.lastBashErrors.push({
			command,
			exitCode,
			timestamp: Date.now(),
		})
		if (state.lastBashErrors.length > MAX_ERROR_HISTORY) {
			state.lastBashErrors = state.lastBashErrors.slice(-MAX_ERROR_HISTORY)
		}
		return
	}

	if (state.lastBashErrors.length > 0) {
		const failedCmd = state.lastBashErrors[state.lastBashErrors.length - 1].command
		state.knowledgeCaptureNeeded = true
		state.captureContext = `错误命令: ${failedCmd} → 成功命令: ${command}`
		log("[knowledge-protection] Trial-and-error success detected", {
			failedCommand: failedCmd,
			successCommand: command,
		})
		state.lastBashErrors = []
	}
}

export function createProtectionState(): ProtectionState {
	return {
		lastBashErrors: [],
		knowledgeCaptureNeeded: false,
		captureContext: null,
	}
}
