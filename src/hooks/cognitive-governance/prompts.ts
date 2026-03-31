import type { CognitiveAssessment } from "./conversation-analyzer"
import { SOFT_PROMPT } from "../../config/gate-prompts"
import { REMEDIATION } from "../../config/gate-prompts"

export function buildCognitiveDirective(assessment: CognitiveAssessment): string | null {
	const parts: string[] = []

	if (assessment.dimensionsGap.length > 0 && assessment.dimensionsCovered.length < 3) {
		parts.push(buildDimensionGapReminder(assessment))
	}

	if (assessment.unresolvedErrors > 0 && assessment.fixAttempts > 1) {
		parts.push(SOFT_PROMPT.errorGuidance(assessment.unresolvedErrors, assessment.fixAttempts))
	}

	if (assessment.pendingVerificationEditsCount > 0) {
		parts.push(SOFT_PROMPT.verificationReminder(assessment.pendingVerificationEditsCount))
	}

	if (assessment.captureNeeded) {
		parts.push(buildCaptureEscalation(assessment))
	}

	if (parts.length === 0) return null

	return [
		SOFT_PROMPT.cognitiveDirectiveHeader(
			assessment.currentLayer,
			assessment.dimensionsCovered.join(", "),
		),
		"",
		...parts,
	].join("\n")
}

function buildDimensionGapReminder(assessment: CognitiveAssessment): string {
	const gapSlice = assessment.dimensionsGap.slice(0, 3)
	const actionGuide = gapSlice.map(dim => {
		const action = REMEDIATION.DEFAULT_REMEDIATION_MAP_EN[dim]
		if (!action) return ""
		return SOFT_PROMPT.dimensionGapActionGuide(dim, action.description, [...action.readTargets])
	}).filter(Boolean).join("\n")

	return [
		SOFT_PROMPT.dimensionGapReminder(assessment.dimensionsCovered, gapSlice),
		"",
		actionGuide,
		"",
		SOFT_PROMPT.dimensionGapFooter(),
	].join("\n")
}

function buildCaptureEscalation(assessment: CognitiveAssessment): string {
	if (assessment.captureUrgency === "critical") {
		return SOFT_PROMPT.captureCritical(assessment.editedFilesCount)
	}
	if (assessment.captureUrgency === "warning") {
		return SOFT_PROMPT.captureWarning(assessment.editedFilesCount)
	}
	return SOFT_PROMPT.captureNudge(assessment.editedFilesCount)
}
