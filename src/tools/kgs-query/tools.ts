import type { PluginInput } from "@opencode-ai/plugin"
import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import type { KGSQuery } from "@gaia/kgs-middleware"
import { createKGSQueryExecutor } from "@gaia/omo-hooks"
import { getKGSService } from "../../features/kgs"
import { log } from "../../shared"

const VALID_QUERY_TYPES = new Set(["impact", "trace", "snapshot", "similar"])

function parseQueryArgs(args: { query_type: string; entity: string; depth?: number; direction?: string; at?: string; compare_to?: string; scope?: string }): KGSQuery | null {
  const { query_type, entity } = args
  if (!VALID_QUERY_TYPES.has(query_type)) return null

  switch (query_type) {
    case "impact":
      return {
        type: "impact",
        entity,
        depth: args.depth ?? 3,
        direction: (args.direction as "upstream" | "downstream" | "both") ?? "both",
      }
    case "trace":
      return {
        type: "trace",
        start: entity,
        direction: (args.direction as "upstream" | "downstream" | "both") ?? "downstream",
      }
    case "snapshot":
      return {
        type: "snapshot",
        entity,
        at: args.at ?? new Date().toISOString(),
        compareTo: args.compare_to,
      }
    case "similar":
      return {
        type: "similar",
        reference: entity,
        scope: args.scope,
      }
    default:
      return null
  }
}

export function createKGSQueryTool(_ctx: PluginInput): Record<string, ToolDefinition> {
  const kgs_query: ToolDefinition = tool({
    description:
      "Query the Knowledge Graph Service (KGS) to understand codebase structure, " +
      "impact analysis, dependency tracing, temporal snapshots, and similar entity discovery. " +
      "Use during Read/Plan phases to gather codebase intelligence before making changes.",
    args: {
      query_type: tool.schema
        .string()
        .describe(
          'Type of query: "impact" (change impact analysis), "trace" (dependency chain), ' +
          '"snapshot" (point-in-time view), "similar" (find related entities)',
        ),
      entity: tool.schema
        .string()
        .describe("Target entity ID (e.g., file path, function name, module ID)"),
      depth: tool.schema
        .number()
        .optional()
        .describe("Max traversal depth for impact/trace queries (default: 3)"),
      direction: tool.schema
        .string()
        .optional()
        .describe('Traversal direction: "upstream", "downstream", or "both" (default: "both")'),
      at: tool.schema
        .string()
        .optional()
        .describe("ISO 8601 timestamp for snapshot queries (default: now)"),
      compare_to: tool.schema
        .string()
        .optional()
        .describe("ISO 8601 timestamp to compare against for snapshot diff"),
      scope: tool.schema
        .string()
        .optional()
        .describe("Scope filter for similar queries (e.g., project or module path)"),
    },
    execute: async (args) => {
      try {
        const query = parseQueryArgs(args)
        if (!query) {
          return `Error: Invalid query_type "${args.query_type}". Must be one of: impact, trace, snapshot, similar`
        }

        const service = getKGSService()
        const executor = createKGSQueryExecutor({ service })
        const result = await executor.executeQuery(query)

        log("[kgs-query] Query executed", {
          queryType: result.queryType,
          success: result.success,
          durationMs: result.durationMs,
        })

        if (!result.success) {
          return `KGS Query failed: ${result.error ?? "unknown error"}`
        }

        return result.summary
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        log("[kgs-query] Unexpected error", { error: message })
        return `Error: ${message}`
      }
    },
  })

  return { kgs_query }
}
