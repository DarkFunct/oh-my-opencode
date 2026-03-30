import type { CognitiveGovernanceConfig } from "../../config"
import type { SessionCognitiveState } from "../cognitive-governance-shared/types"
import { buildDeliveryVerificationBlock, buildDocumentationGovernanceBlock, type DirectiveBlock } from "./delivery-verification-prompts"
import { buildCausalAnalysisBlock } from "./causal-analysis-prompts"
import type { CausalAnalysisOptions } from "./causal-analysis-prompts"
import { buildRetrospectiveBlock, DEFAULT_RETROSPECTIVE_CONFIG } from "./retrospective-prompts"

export function collectDvDgCaBlocks(
	state: SessionCognitiveState,
	config?: CognitiveGovernanceConfig,
): DirectiveBlock[] {
	const blocks: DirectiveBlock[] = []

	const dvEnabled = config?.delivery_verification?.enabled ?? true
	if (dvEnabled) {
		const dvBlock = buildDeliveryVerificationBlock(state.deliveryEvidence)
		if (dvBlock) blocks.push(dvBlock)
	}

	const dgEnabled = config?.documentation_governance?.enabled ?? true
	if (dgEnabled) {
		const dgThreshold = config?.documentation_governance?.code_without_doc_threshold ?? 3
		const dgBlock = buildDocumentationGovernanceBlock(state.documentationEvidence, dgThreshold)
		if (dgBlock) blocks.push(dgBlock)
	}

	const caEnabled = config?.causal_analysis?.enabled ?? true
	if (caEnabled) {
		const caThreshold = config?.causal_analysis?.ca_trigger_failures ?? 2
		const caOpts: CausalAnalysisOptions = {
			include_counterfactual: config?.causal_analysis?.include_counterfactual ?? true,
			include_boundary_closure: config?.causal_analysis?.include_boundary_closure ?? true,
		}
		const caBlock = buildCausalAnalysisBlock(state.consecutiveFixFailures, caThreshold, caOpts)
		if (caBlock) blocks.push(caBlock)
	}

	const retroConfig = config?.retrospective
		? { ...DEFAULT_RETROSPECTIVE_CONFIG, ...config.retrospective }
		: DEFAULT_RETROSPECTIVE_CONFIG
	const retroBlock = buildRetrospectiveBlock(state.consecutiveFixFailures, retroConfig)
	if (retroBlock) blocks.push(retroBlock)

	return blocks
}

const PRIORITY_ORDER: Record<DirectiveBlock["priority"], number> = {
	critical: 0,
	high: 1,
	medium: 2,
	low: 3,
}

export function composeDirectiveWithBlocks(
	baseDirective: string | null,
	blocks: DirectiveBlock[],
): string | null {
	if (blocks.length === 0) return baseDirective

	const sorted = [...blocks].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
	const blockText = sorted.map((b) => b.content).join("\n\n")

	if (!baseDirective) return blockText
	return `${baseDirective}\n\n${blockText}`
}
