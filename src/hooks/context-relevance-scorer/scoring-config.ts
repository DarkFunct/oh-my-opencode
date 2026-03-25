import type { FusionConfig } from "../cognitive-governance-shared/types"

export const DEFAULT_DECAY_WINDOW = 10
export const DEFAULT_MAX_EXPECTED_CITATIONS = 5

export const DEFAULT_FUSION_CONFIG: FusionConfig = {
	weights: {
		structural: 0.6,
		semantic: 0.4,
	},
	thresholds: {
		keep: 0.6,
		noInject: 0.3,
	},
	expireGuard: {
		margin: 0.05,
		maxDeferRounds: 2,
	},
	semanticSampling: {
		enabled: false,
		interval: 3,
	},
	fallback: "structural_only",
}
