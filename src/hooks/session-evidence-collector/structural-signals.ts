import type { SourceType, StructuralSignals } from "../cognitive-governance-shared/types"

export function extractFilePath(tool: string, args: Record<string, unknown>): string | undefined {
	if (typeof args.filePath === "string") return args.filePath
	if (typeof args.file_path === "string") return args.file_path
	if (tool === "apply_patch" && typeof args.patchText === "string") {
		const patchPath = extractPatchPath(args.patchText)
		if (patchPath) return patchPath
	}
	if (tool === "bash" && typeof args.command === "string") return undefined
	return undefined
}

function extractPatchPath(patchText: string): string | undefined {
	const match = patchText.match(/^\*\*\*\s+(?:Add|Update|Delete)\s+File:\s+(.+)$/im)
	return match?.[1]?.trim()
}

export function extractStructuralSignals(
	source: SourceType,
	output: string,
	metadata: Record<string, unknown>,
): StructuralSignals {
	const signals: StructuralSignals = {}

	signals.filePath = extractFilePath("", metadata)

	if (source === "shell_command") {
		signals.exitCode = extractExitCode(output)
	}

	if (source === "lsp_structured") {
		signals.diagnosticCount = extractDiagnosticCount(output)
		signals.lineNumber = extractLineNumber(output)
	}

	if (source === "search_result") {
		signals.matchCount = extractMatchCount(output)
	}

	if (source === "file_modification") {
		signals.editSuccess = extractEditSuccess(output)
	}

	if (source === "agent_output") {
		signals.taskStatus = extractTaskStatus(output)
	}

	return signals
}

const EXIT_CODE_PATTERN = /exit code[:\s]+(\d+)/i
const EXIT_CODE_ALT = /exited with (?:code )?(\d+)/i
const EXIT_CODE_PREFIX = /^(\d+)$/

function extractExitCode(output: string): number | undefined {
	const match = output.match(EXIT_CODE_PATTERN) ?? output.match(EXIT_CODE_ALT)
	if (match) return parseInt(match[1], 10)

	const lines = output.trim().split("\n")
	const lastLine = lines[lines.length - 1]?.trim()
	if (lastLine && EXIT_CODE_PREFIX.test(lastLine) && lines.length > 1) {
		return parseInt(lastLine, 10)
	}

	if (output.includes("Process completed successfully") || output.includes("exit code 0")) return 0

	return undefined
}

function extractDiagnosticCount(output: string): number | undefined {
	const errorMatch = output.match(/(\d+)\s+errors?/i)
	if (errorMatch) return parseInt(errorMatch[1], 10)

	if (output.includes("No diagnostics found") || output.includes("0 errors")) return 0

	const lines = output.trim().split("\n").filter((l) => l.trim().length > 0)
	if (lines.length === 0) return 0

	const diagnosticLines = lines.filter((l) => /\b(error|warning|hint|info)\b/i.test(l))
	return diagnosticLines.length > 0 ? diagnosticLines.length : undefined
}

function extractLineNumber(output: string): number | undefined {
	const match = output.match(/line\s+(\d+)/i) ?? output.match(/:(\d+):\d+/)
	return match ? parseInt(match[1], 10) : undefined
}

function extractMatchCount(output: string): number | undefined {
	const countMatch = output.match(/(\d+)\s+match(?:es)?/i)
	if (countMatch) return parseInt(countMatch[1], 10)

	if (output.includes("No matches found") || output.includes("0 matches")) return 0

	return undefined
}

function extractEditSuccess(output: string): boolean | undefined {
	if (/Edit applied successfully|Wrote file successfully/i.test(output)) return true
	if (/oldString not found|Found multiple matches/i.test(output)) return false
	return undefined
}

function extractTaskStatus(output: string): "completed" | "error" | "pending" | undefined {
	if (/Status.*\*?\*?error\*?\*?|The task encountered an error|\[task ERROR\]/i.test(output)) return "error"
	if (/Status.*\*?\*?completed?\*?\*?|task completed/i.test(output)) return "completed"
	if (/Status.*\*?\*?pending\*?\*?|still in progress/i.test(output)) return "pending"
	return undefined
}
