import type { RawCaptureInput } from "@gaia/omo-hooks"

const DECISION_PATTERN = /(?:decision|decided|chose|rationale)[:\s]+["']?(.+?)["']?\s*(?:because|rationale|reason)[:\s]+["']?(.+?)["']?(?:\n|$)/gi
const PITFALL_PATTERN = /(?:pitfall|gotcha|warning|watch out|caution)[:\s]+["']?(.+?)["']?\s*(?:symptom|cause|because)[:\s]+["']?(.+?)["']?\s*(?:fix|solution|workaround)[:\s]+["']?(.+?)["']?(?:\n|$)/gi
const PATTERN_NAMES = /(?:pattern|design pattern|architecture)[:\s]+["']?(\w[\w\s-]+\w)["']?/gi
const CONSTRAINT_PATTERN = /(?:constraint|must not|must|forbidden|required|mandatory|never|always)[:\s]+["']?(.+?)["']?(?:\n|$)/gi

export function extractDesignDecisions(text: string): RawCaptureInput["designDecisions"] {
  const results: NonNullable<RawCaptureInput["designDecisions"]> = []
  const seen = new Set<string>()

  for (const match of text.matchAll(DECISION_PATTERN)) {
    const title = match[1]?.trim()
    const rationale = match[2]?.trim()
    if (!title || !rationale || seen.has(title)) continue
    seen.add(title)
    results.push({ title, rationale })
  }

  return results.length > 0 ? results : undefined
}

export function extractPitfalls(text: string): RawCaptureInput["pitfalls"] {
  const results: NonNullable<RawCaptureInput["pitfalls"]> = []
  const seen = new Set<string>()

  for (const match of text.matchAll(PITFALL_PATTERN)) {
    const title = match[1]?.trim()
    const symptom = match[2]?.trim()
    const fix = match[3]?.trim()
    if (!title || !symptom || !fix || seen.has(title)) continue
    seen.add(title)
    results.push({ title, symptom, fix })
  }

  return results.length > 0 ? results : undefined
}

export function extractPatterns(text: string): RawCaptureInput["patterns"] {
  const results: NonNullable<RawCaptureInput["patterns"]> = []
  const seen = new Set<string>()

  for (const match of text.matchAll(PATTERN_NAMES)) {
    const name = match[1]?.trim()
    if (!name || seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    results.push({ name, confidence: 0.7 })
  }

  return results.length > 0 ? results : undefined
}

export function extractConstraints(text: string): RawCaptureInput["constraints"] {
  const results: NonNullable<RawCaptureInput["constraints"]> = []
  const seen = new Set<string>()

  for (const match of text.matchAll(CONSTRAINT_PATTERN)) {
    const title = match[1]?.trim()
    if (!title || title.length < 10 || title.length > 200 || seen.has(title)) continue
    seen.add(title)

    const level = inferConstraintLevel(match[0])
    results.push({ title, level })
  }

  return results.length > 0 ? results.slice(0, 10) : undefined
}

function inferConstraintLevel(matchText: string): string {
  const lower = matchText.toLowerCase()
  if (lower.startsWith("must not") || lower.startsWith("forbidden") || lower.startsWith("never")) return "critical"
  if (lower.startsWith("must") || lower.startsWith("required") || lower.startsWith("mandatory")) return "required"
  if (lower.startsWith("always")) return "recommended"
  return "advisory"
}
