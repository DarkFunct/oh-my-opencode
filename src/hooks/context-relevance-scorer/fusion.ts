import type {
	StructuralScoring,
	SemanticEvaluation,
	FusionConfig,
	RelevanceResult,
	RelevanceAction,
	PendingExpireEntry,
} from "../cognitive-governance-shared/types"

export function evaluate(
	structural: StructuralScoring,
	semantic: SemanticEvaluation | null,
	config: FusionConfig,
	pending?: PendingExpireEntry,
): RelevanceResult {
	const structScore =
		(structural.recency + structural.citation + structural.superseded) / 3

	if (semantic === null) {
		return {
			composite: structScore,
			action: decideAction(structScore, config.thresholds, config.expireGuard, pending),
			trackUsed: "structural_only",
		}
	}

	const semScore =
		(semantic.taskRelevance + semantic.causalContribution) / 2
	const composite =
		config.weights.structural * structScore +
		config.weights.semantic * semScore

	return {
		composite,
		action: decideAction(composite, config.thresholds, config.expireGuard, pending),
		trackUsed: "dual",
	}
}

export function decideAction(
	score: number,
	thresholds: FusionConfig["thresholds"],
	guard: FusionConfig["expireGuard"],
	pending?: PendingExpireEntry,
): RelevanceAction {
	if (score >= thresholds.keep) return "keep"
	if (score >= thresholds.noInject) return "no_inject"

	// C-010-15: expire guard — delay confirmation in margin zone
	const inMargin = score >= thresholds.noInject - guard.margin
	if (inMargin) {
		if (!pending || pending.deferredRounds < guard.maxDeferRounds) {
			return "pending_expire"
		}
	}
	return "expire"
}
