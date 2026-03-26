import type {
	SourceType,
	StructuralSignals,
	TextMatchResult,
	ClassificationResult,
} from "../cognitive-governance-shared/types"

const UNKNOWN_CONFIDENCE_CAP = 0.5

export function fuseConfidence(
	structural: StructuralSignals,
	textMatches: TextMatchResult[],
	source: SourceType,
): ClassificationResult {
	if (source === "lsp_structured" && structural.diagnosticCount !== undefined) {
		return {
			classification: structural.diagnosticCount > 0 ? "error" : "info",
			confidence: 1.0,
			source,
			evidence: [`lsp diagnosticCount=${structural.diagnosticCount}`],
		}
	}

	// II-1: file_modification structural signal — editSuccess is deterministic
	if (source === "file_modification" && structural.editSuccess !== undefined) {
		if (!structural.editSuccess) {
			return {
				classification: "error",
				confidence: 0.95,
				source,
				evidence: [`editSuccess=false`, ...textMatches.map((m) => m.pattern)],
			}
		}
		return { classification: "info", confidence: 0.9, source, evidence: [`editSuccess=true`] }
	}

	// II-1: agent_output structural signal — taskStatus from task/background_output
	if (source === "agent_output" && structural.taskStatus !== undefined) {
		if (structural.taskStatus === "error") {
			return {
				classification: "error",
				confidence: 0.9,
				source,
				evidence: [`taskStatus=error`, ...textMatches.map((m) => m.pattern)],
			}
		}
		if (structural.taskStatus === "completed") {
			return { classification: "info", confidence: 0.9, source, evidence: [`taskStatus=completed`] }
		}
	}

	if (structural.exitCode !== undefined && textMatches.length > 0) {
		const isError = structural.exitCode !== 0
		const textClassification = highestSeverity(textMatches)
		return {
			classification: isError ? textClassification : "info",
			confidence: 0.9,
			source,
			evidence: [`exitCode=${structural.exitCode}`, ...textMatches.map((m) => m.pattern)],
		}
	}

	if (structural.exitCode !== undefined) {
		if (structural.exitCode === 0) {
			return { classification: "info", confidence: 0.8, source, evidence: [`exitCode=0`] }
		}
		// Exit code alone without corroborating text patterns is ambiguous —
		// common false positives: grep(1), diff(1), test(1), find(1)
		return {
			classification: "ambiguous",
			confidence: 0.6,
			source,
			evidence: [`exitCode=${structural.exitCode}`],
		}
	}

	if (textMatches.length > 0) {
		const confidence = source === "unknown" ? UNKNOWN_CONFIDENCE_CAP : 0.5
		return {
			classification: "ambiguous",
			confidence,
			source,
			evidence: textMatches.map((m) => m.pattern),
		}
	}

	return {
		classification: "info",
		confidence: 1.0,
		source,
		evidence: ["no signals"],
	}
}

function highestSeverity(matches: TextMatchResult[]): "error" | "warning" | "info" {
	if (matches.some((m) => m.classification === "error")) return "error"
	if (matches.some((m) => m.classification === "warning")) return "warning"
	return "info"
}
