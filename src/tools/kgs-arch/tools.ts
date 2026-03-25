import type { PluginInput } from "@opencode-ai/plugin"
import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import * as OmoHooks from "@gaia/omo-hooks"
import { getKGSStore } from "../../features/kgs"
import { log } from "../../shared"

const VALID_OPERATIONS = new Set(["reconcile", "audit", "health"])

type ArchOperation = "reconcile" | "audit" | "health"

type ArchExecutionResult = {
  success: boolean
  operation: ArchOperation
  summary: string
  error?: string
  durationMs: number
}

type KGSArchaeologyExecutor = {
  execute: (
    operation: ArchOperation,
    projectRoot: string,
    options?: { autoFix?: boolean },
  ) => Promise<ArchExecutionResult>
}

type KGSArchaeologyFactory = (config: {
  store: ReturnType<typeof getKGSStore>
}) => KGSArchaeologyExecutor

function resolveArchaeologyFactory(): KGSArchaeologyFactory {
  const candidate = (OmoHooks as Record<string, unknown>).createKGSArchaeologyExecutor
  if (typeof candidate !== "function") {
    throw new Error("createKGSArchaeologyExecutor is not exported by @gaia/omo-hooks")
  }
  return candidate as KGSArchaeologyFactory
}

export function createKGSArchTool(_ctx: PluginInput): Record<string, ToolDefinition> {
  const kgs_archaeology: ToolDefinition = tool({
    description:
      "Run KGS (Knowledge Graph Service) archaeology operations: reconcile graph " +
      "against source code, audit graph health and corruption, or calculate overall " +
      "graph health score. Use for maintenance and diagnostics.",
    args: {
      operation: tool.schema
        .string()
        .describe(
          'Operation to run: "reconcile" (compare graph vs source, find/fix inconsistencies), ' +
          '"audit" (full graph health audit with corruption detection), ' +
          '"health" (calculate overall health score with dimensional metrics)',
        ),
      project_root: tool.schema
        .string()
        .optional()
        .describe("Project root directory for reconcile/audit operations (default: current working directory)"),
      auto_fix: tool.schema
        .boolean()
        .optional()
        .describe("Whether to automatically fix issues found during reconciliation (default: false)"),
    },
    execute: async (args) => {
      try {
        const operation = args.operation
        if (!VALID_OPERATIONS.has(operation)) {
          return `Error: Invalid operation "${operation}". Must be one of: reconcile, audit, health`
        }

        const store = getKGSStore()
        const createKGSArchaeologyExecutor = resolveArchaeologyFactory()
        const executor = createKGSArchaeologyExecutor({ store })
        const projectRoot = args.project_root ?? (typeof _ctx.directory === "string" ? _ctx.directory : process.cwd())
        const result = await executor.execute(
          operation as ArchOperation,
          projectRoot,
          { autoFix: args.auto_fix ?? false },
        )

        log("[kgs-arch] Operation executed", {
          operation: result.operation,
          success: result.success,
          durationMs: result.durationMs,
        })

        if (!result.success) {
          return `KGS Archaeology failed: ${result.error ?? "unknown error"}`
        }

        return result.summary
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        log("[kgs-arch] Unexpected error", { error: message })
        return `Error: ${message}`
      }
    },
  })

  return { kgs_archaeology }
}
