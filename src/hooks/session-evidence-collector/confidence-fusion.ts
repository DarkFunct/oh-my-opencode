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
		return {
			classification: structural.exitCode !== 0 ? "error" : "info",
			confidence: 0.8,
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
