import path from "node:path"

import { normalizeRelativePosix } from "@gaia/kgs-middleware"

const KNOWLEDGE_PREFIX = "_meta/knowledge/"
const KNOWLEDGE_EXTENSIONS = new Set([".md", ".yaml", ".yml", ".json", ".toml", ".txt"])

export function extractFilePathFromArgs(args: Record<string, unknown>): string | null {
  const candidate = args.filePath ?? args.file_path ?? args.path ?? args.file
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null
}

export function extractFilePathFromMetadata(
  pendingPath: string | null,
  output: { output: string; metadata: Record<string, unknown> },
): string | null {
  if (pendingPath) return pendingPath

  const metaPath = output.metadata?.filePath ?? output.metadata?.file_path ?? output.metadata?.path
  if (typeof metaPath === "string" && metaPath.length > 0) return metaPath

  const text = output.output ?? ""
  const verbMatch = text.match(/(?:updated|wrote|edited|created|modified|moved|deleted)\s+(?:\d+\s+bytes\s+to\s+)?(?:file\s+)?[`"]?([^\s`"\n]+\.[a-zA-Z0-9]{1,10})[`"]?/i)
  if (verbMatch?.[1]) return verbMatch[1]

  const absMatch = text.match(/(\/[^\s`"\n]+\.[a-zA-Z0-9]{1,10})/m)
  return absMatch?.[1] ?? null
}

export function normalizeToolFilePath(filePath: string, projectRoot: string): string {
  if (path.isAbsolute(filePath)) {
    const relative = path.relative(projectRoot, filePath)
    return normalizeRelativePosix(relative)
  }
  return normalizeRelativePosix(filePath)
}

export function isKnowledgeDocumentPath(filePath: string): boolean {
  if (!filePath.startsWith(KNOWLEDGE_PREFIX)) {
    return false
  }

  const ext = path.extname(filePath).toLowerCase()
  return KNOWLEDGE_EXTENSIONS.has(ext)
}
