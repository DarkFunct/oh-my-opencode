const READ_LINE_PATTERN = /^\s*\d+(?:#[a-f0-9]{8})?[|:]\s?(.*)$/i

function stripReadLinePrefix(line: string): string | null {
  const match = READ_LINE_PATTERN.exec(line)
  return match?.[1] ?? null
}

export function extractReadText(output: string): string {
  if (!output) return ""

  const lines = output.split("\n")
  const extracted: string[] = []
  for (const line of lines) {
    const parsed = stripReadLinePrefix(line)
    if (parsed !== null) {
      extracted.push(parsed)
    }
  }

  if (extracted.length > 0) {
    return extracted.join("\n")
  }

  return output
}
