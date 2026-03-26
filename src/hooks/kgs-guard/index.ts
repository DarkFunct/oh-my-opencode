import type { PluginInput } from "@opencode-ai/plugin"
import { createKGSGuard, type RawCaptureInput } from "@gaia/omo-hooks"
import { getKGSService } from "../../features/kgs"
import { log } from "../../shared"
import { extractDesignDecisions, extractPitfalls, extractPatterns, extractConstraints } from "./semantic-extractor"

const KGS_GUARD_LOG_PREFIX = "[kgs-guard]"

const EXEMPT_AGENTS = new Set(["explore", "librarian", "oracle", "metis", "momus"])

const MIN_OUTPUT_LENGTH = 100

function getAgentFromMetadata(metadata: Record<string, unknown> | undefined): string | undefined {
  if (!metadata) return undefined
  const agent = metadata.agent ?? metadata.agentName ?? metadata.agent_name
  return typeof agent === "string" ? agent.toLowerCase() : undefined
}

function extractCaptureInput(responseText: string, metadata: Record<string, unknown>): RawCaptureInput | null {
  const taskDescription = typeof metadata.description === "string" ? metadata.description : ""

  const changedFilePaths = extractChangedFiles(responseText)
  if (changedFilePaths.length === 0 && taskDescription.trim().length === 0) {
    return null
  }

  return {
    changedFiles: changedFilePaths,
    taskDescription,
    readEvidence: extractEvidence(responseText, "Read"),
    planEvidence: extractEvidence(responseText, "Plan"),
    executeEvidence: extractEvidence(responseText, "Execute"),
    captureEvidence: extractEvidence(responseText, "Capture"),
    designDecisions: extractDesignDecisions(responseText),
    pitfalls: extractPitfalls(responseText),
    patterns: extractPatterns(responseText),
    constraints: extractConstraints(responseText),
  }
}

function extractChangedFiles(text: string): RawCaptureInput["changedFiles"] {
  const filePatterns = text.match(/(?:created?|modified?|edited|wrote|updated|deleted|renamed|moved)\s+(?:\d+\s+bytes\s+to\s+)?(?:file\s+)?[`"]?([^\s`"]+\.[a-zA-Z0-9]{1,10})[`"]?/gi)
  if (!filePatterns) return []

  const seen = new Set<string>()
  const files: RawCaptureInput["changedFiles"] = []

  for (const match of filePatterns) {
    const pathMatch = match.match(/[`"]?([^\s`"]+\.[a-zA-Z0-9]{1,10})[`"]?$/)
    if (!pathMatch?.[1] || seen.has(pathMatch[1])) continue
    seen.add(pathMatch[1])

    const changeType = match.match(/^(created?|modified?|edited|wrote|updated|deleted|renamed|moved)/i)?.[1]?.toLowerCase() ?? "modify"
    const mapped = changeType.startsWith("creat") ? "create" as const
      : changeType.startsWith("delet") ? "delete" as const
      : changeType.startsWith("renam") ? "rename" as const
      : "modify" as const

    files.push({ path: pathMatch[1], changeType: mapped })
  }

  return files
}

function extractEvidence(text: string, phase: string): string[] {
  const pattern = new RegExp(`(?:${phase}[:\\s]+)(.+?)(?:\\n|$)`, "gi")
  const matches = text.match(pattern)
  return matches ? matches.slice(0, 5).map(m => m.trim()) : []
}

export function createKGSGuardHook(_ctx: PluginInput) {
  return {
    "tool.execute.after": async (
      input: { tool: string; sessionID: string; callID: string },
      output: { title: string; output: string; metadata: Record<string, unknown> },
    ) => {
      if (input.tool !== "Task" && input.tool !== "task") return

      if (output.metadata?.sync === false || output.metadata?.run_in_background === true) {
        log(`${KGS_GUARD_LOG_PREFIX} Background launch, skipping`, { sessionID: input.sessionID })
        return
      }

      const responseText = output.output?.trim() ?? ""
      if (responseText.length < MIN_OUTPUT_LENGTH) return

      const agent = getAgentFromMetadata(output.metadata)
      if (agent && EXEMPT_AGENTS.has(agent)) {
        log(`${KGS_GUARD_LOG_PREFIX} Exempt agent, skipping`, { agent })
        return
      }

      const captureInput = extractCaptureInput(responseText, output.metadata)
      if (!captureInput) {
        log(`${KGS_GUARD_LOG_PREFIX} No capture input extracted, skipping`)
        return
      }

      try {
        const service = getKGSService()
        const guard = createKGSGuard({
          service,
          onWarning: (warning) => log(`${KGS_GUARD_LOG_PREFIX} ${warning}`),
        })

        const result = await guard.captureKnowledge(captureInput)

        log(`${KGS_GUARD_LOG_PREFIX} Capture complete`, {
          success: result.success,
          retriesUsed: result.retriesUsed,
          durationMs: result.durationMs,
          warningCount: result.warnings.length,
        })

        if (!result.success) {
          output.output = `${output.output ?? ""}\n\n[KGS Guard] Knowledge capture failed: ${result.error ?? "unknown"}`
        }
      } catch (error) {
        log(`${KGS_GUARD_LOG_PREFIX} Unexpected error`, { error })
      }
    },
  }
}
