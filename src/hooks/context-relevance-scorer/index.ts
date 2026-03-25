import type { SessionCognitiveState } from "../cognitive-governance-shared/types"
import { computeStructuralScoring } from "./structural-scoring"
import { evaluateSemantic } from "./semantic-evaluator"
import { evaluate } from "./fusion"
import { DEFAULT_FUSION_CONFIG } from "./scoring-config"

export function scoreAllEvidences(state: SessionCognitiveState): void {
	const config = DEFAULT_FUSION_CONFIG

	for (const error of state.detectedErrors) {
		const errorId = buildErrorId(error.tool, error.timestamp, error.filePath)

		const structural = computeStructuralScoring(error, state)
		const semantic = evaluateSemantic()
		const pending = state.pendingExpires.get(errorId)
		const result = evaluate(structural, semantic, config, pending)

		state.evidenceRelevance.set(errorId, result)

		if (result.action === "pending_expire") {
			const existing = state.pendingExpires.get(errorId)
			if (existing) {
				existing.deferredRounds++
			} else {
				state.pendingExpires.set(errorId, {
					contentId: errorId,
					firstExpireScore: result.composite,
					deferredRounds: 1,
					trackUsed: result.trackUsed,
					reason: `score=${result.composite.toFixed(3)} in margin zone`,
				})
			}
		} else if (result.action === "expire" || result.action === "keep") {
			state.pendingExpires.delete(errorId)
		}
	}
}

function buildErrorId(tool: string, timestamp: number, filePath?: string): string {
	const pathPart = filePath ?? "unknown"
	return `${tool}:${pathPart}:${timestamp}`
}
