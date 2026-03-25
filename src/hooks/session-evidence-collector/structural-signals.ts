import type { SourceType, StructuralSignals } from "../cognitive-governance-shared/types"

export function extractFilePath(tool: string, args: Record<string, unknown>): string | undefined {
	if (typeof args.filePath === "string") return args.filePath
	if (typeof args.file_path === "string") return args.file_path
	if (tool === "bash" && typeof args.command === "string") return undefined
	return undefined
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
