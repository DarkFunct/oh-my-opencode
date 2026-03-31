import type { RawCaptureInput } from "@gaia/omo-hooks"
import { extractDesignDecisions, extractPitfalls, extractPatterns, extractConstraints } from "./semantic-extractor"

export interface KGSGuardConfig {
	write_debounce_ms?: number
}

export function extractCaptureInput(responseText: string, metadata: Record<string, unknown>): RawCaptureInput | null {
	const taskDescription = typeof metadata.description === "string" ? metadata.description : ""

	const changedFilePaths = extractChangedFiles(responseText)
	if (changedFilePaths.length === 0 && taskDescription.trim().length === 0) {
		return null
	}

	return {
		changedFiles: changedFilePaths,
		taskDescription,
		readEvidence: extractEvidence(responseText, "Read"),
		planEvidence: extractEvidence(responseText, "Plan"),
		executeEvidence: extractEvidence(responseText, "Execute"),
		captureEvidence: extractEvidence(responseText, "Capture"),
		designDecisions: extractDesignDecisions(responseText),
		pitfalls: extractPitfalls(responseText),
		patterns: extractPatterns(responseText),
		constraints: extractConstraints(responseText),
	}
}

function extractChangedFiles(text: string): RawCaptureInput["changedFiles"] {
	const filePatterns = text.match(/(?:created?|modified?|edited|wrote|updated|deleted|renamed|moved)\s+(?:\d+\s+bytes\s+to\s+)?(?:file\s+)?[`"]?([^\s`"]+\.[a-zA-Z0-9]{1,10})[`"]?/gi)
	if (!filePatterns) return []

	const seen = new Set<string>()
	const files: RawCaptureInput["changedFiles"] = []

	for (const match of filePatterns) {
		const pathMatch = match.match(/[`"]?([^\s`"]+\.[a-zA-Z0-9]{1,10})[`"]?$/)
		if (!pathMatch?.[1] || seen.has(pathMatch[1])) continue
		seen.add(pathMatch[1])

		const changeType = match.match(/^(created?|modified?|edited|wrote|updated|deleted|renamed|moved)/i)?.[1]?.toLowerCase() ?? "modify"
		const mapped = changeType.startsWith("creat") ? "create" as const
			: changeType.startsWith("delet") ? "delete" as const
			: changeType.startsWith("renam") ? "rename" as const
			: "modify" as const

		files.push({ path: pathMatch[1], changeType: mapped })
	}

	return files
}

function extractEvidence(text: string, phase: string): string[] {
	const pattern = new RegExp(`(?:${phase}[:\\s]+)(.+?)(?:\\n|$)`, "gi")
	const matches = text.match(pattern)
	return matches ? matches.slice(0, 5).map(m => m.trim()) : []
}

export function extractFilePathFromArgs(args: Record<string, unknown>): string | undefined {
	const filePath = args.filePath ?? args.file_path ?? args.path
	return typeof filePath === "string" ? filePath : undefined
}
