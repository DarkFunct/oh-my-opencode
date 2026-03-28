import type { Message, Part } from "@opencode-ai/sdk"
import type { CognitiveLayer, MethodologyDimension } from "../cognitive-governance-shared/types"
import type { CognitiveReviewVerdictInput } from "../cognitive-governance-shared/review-state"

type MessageWithParts = {
	info: Message
	parts: Part[]
}

const STAGE_B_PATTERN = /<cognitive_stage_b>\s*([\s\S]*?)\s*<\/cognitive_stage_b>/i
const LAYERS = new Set<CognitiveLayer>(["perception", "understanding", "rationality"])
const DIMENSIONS = new Set<MethodologyDimension>([
	"technical",
	"empirical",
	"theoretical",
	"engineering",
	"philosophical",
])

function extractTextContent(part: Part): string | null {
	const type = part.type as string
	if (type === "text" || type === "reasoning") {
		const text = (part as { text?: unknown }).text
		return typeof text === "string" ? text : null
	}
	return null
}

function toRisk(conclusion: "pass" | "pending" | "fail"): "low" | "medium" | "high" {
	if (conclusion === "pass") return "low"
	if (conclusion === "fail") return "high"
	return "medium"
}

function parseStageBPayload(raw: string): CognitiveReviewVerdictInput | null {
	try {
		const parsed = JSON.parse(raw) as Record<string, unknown>

		const conclusionRaw = typeof parsed.conclusion === "string" ? parsed.conclusion.toLowerCase() : ""
		if (conclusionRaw !== "pass" && conclusionRaw !== "fail" && conclusionRaw !== "pending") {
			return null
		}

		const layer = typeof parsed.layer === "string" ? parsed.layer.toLowerCase() : ""
		if (!LAYERS.has(layer as CognitiveLayer)) return null

		const dimensionsRaw = Array.isArray(parsed.dimensions) ? parsed.dimensions : []
		const dimensions = Array.from(new Set(dimensionsRaw))
			.filter((entry): entry is string => typeof entry === "string")
			.map((entry) => entry.toLowerCase())
			.filter((entry): entry is MethodologyDimension => DIMENSIONS.has(entry as MethodologyDimension))

		if (dimensions.length === 0) return null

		const confidenceRaw = typeof parsed.confidence === "number" ? parsed.confidence : NaN
		const confidence = Number.isFinite(confidenceRaw)
			? Math.max(0, Math.min(1, confidenceRaw))
			: 0.5

		const reasonsRaw = Array.isArray(parsed.reasons) ? parsed.reasons : []
		const reasons = reasonsRaw.filter((entry): entry is string => typeof entry === "string")

		return {
			conclusion: conclusionRaw,
			stage: "B",
			layer: layer as CognitiveLayer,
			dimensions,
			confidence,
			reasons,
			risk: toRisk(conclusionRaw),
			source: "llm-stage-b",
		}
	} catch {
		return null
	}
}

export function extractLatestStageBVerdict(messages: MessageWithParts[]): CognitiveReviewVerdictInput | null {
	for (let i = messages.length - 1; i >= 0; i--) {
		const message = messages[i]
		if (message.info.role !== "assistant") continue

		for (let j = message.parts.length - 1; j >= 0; j--) {
			const content = extractTextContent(message.parts[j])
			if (!content) continue
			const match = content.match(STAGE_B_PATTERN)
			if (!match) continue
			const verdict = parseStageBPayload(match[1])
			if (verdict) return verdict
		}
	}

	return null
}
