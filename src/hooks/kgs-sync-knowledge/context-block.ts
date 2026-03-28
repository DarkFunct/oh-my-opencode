import type { KnowledgeRetrieveContextResponse } from "@gaia/kgs-middleware"

function formatEntityList(response: KnowledgeRetrieveContextResponse): string {
  if (response.matchedEntities.length === 0) {
    return "- none"
  }

  return response.matchedEntities
    .slice(0, 5)
    .map((entity) => `- ${entity.type} ${entity.path || entity.fqn} (${entity.matchReason})`)
    .join("\n")
}

export function formatKnowledgeContextBlock(response: KnowledgeRetrieveContextResponse): string {
  const lines = [
    "<kgs_context>",
    `document: ${response.documentPath}`,
    `keywords: ${response.extractedKeywords.slice(0, 8).join(", ") || "none"}`,
    `relationships: ${response.summary.totalRelationships}`,
    `risk_hints: ${response.summary.riskHints.join(" | ") || "none"}`,
    "entities:",
    formatEntityList(response),
  ]

  if (response.warnings.length > 0) {
    lines.push(`warnings: ${response.warnings.join(" | ")}`)
  }

  lines.push("</kgs_context>")
  return lines.join("\n")
}
