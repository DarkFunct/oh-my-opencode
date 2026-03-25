import type { PluginInput } from "@opencode-ai/plugin"
import * as OmoHooks from "@gaia/omo-hooks"
import { getKGSStore } from "../../features/kgs"
import { log } from "../../shared"

const KGS_SYNC_LOG_PREFIX = "[kgs-sync]"

const FILE_WRITE_TOOLS = new Set(["Write", "write", "Edit", "edit"])

type SyncResult = {
  processed: boolean
  nodesAffected: number
  edgesAffected: number
  duration_ms: number
}

type BatchSyncResult = {
  totalEvents: number
  processed: number
  skipped: number
  duration_ms: number
}

type KGSSyncAdapter = {
  onFileChange(
    filePath: string,
    changeType: "create" | "modify" | "delete" | "rename",
    projectRoot: string,
    oldPath?: string,
  ): void
  flush(): Promise<void>
  dispose(): void
}

type KGSSyncFactory = (config: {
  store: ReturnType<typeof getKGSStore>
  onSync?: (result: SyncResult) => void
  onBatchSync?: (result: BatchSyncResult) => void
  onError?: (error: string) => void
}) => KGSSyncAdapter

function resolveSyncFactory(): KGSSyncFactory {
  const candidate = (OmoHooks as Record<string, unknown>).createKGSSyncAdapter
  if (typeof candidate !== "function") {
    throw new Error("createKGSSyncAdapter is not exported by @gaia/omo-hooks")
  }
  return candidate as KGSSyncFactory
}

function extractFilePath(
  _input: { tool: string },
  output: { output: string; metadata: Record<string, unknown> },
): string | null {
  const metaPath = output.metadata?.filePath ?? output.metadata?.file_path ?? output.metadata?.path
  if (typeof metaPath === "string" && metaPath.length > 0) return metaPath

  const match = output.output?.match(/(?:wrote|edited|created|modified)\s+(?:file\s+)?[`"]?([^\s`"\n]+\.[a-zA-Z]{1,10})[`"]?/i)
  return match?.[1] ?? null
}

function inferChangeType(tool: string): "create" | "modify" {
  if (tool === "Write" || tool === "write") return "create"
  return "modify"
}

export function createKGSSyncHook(_ctx: PluginInput) {
  let adapter: KGSSyncAdapter | null = null

  function getAdapter(): KGSSyncAdapter {
    if (!adapter) {
      const store = getKGSStore()
      const createKGSSyncAdapter = resolveSyncFactory()
      adapter = createKGSSyncAdapter({
        store,
        onSync: (result) => {
          log(`${KGS_SYNC_LOG_PREFIX} File synced`, {
            processed: result.processed,
            nodesAffected: result.nodesAffected,
            edgesAffected: result.edgesAffected,
            duration_ms: result.duration_ms,
          })
        },
        onBatchSync: (result) => {
          log(`${KGS_SYNC_LOG_PREFIX} Batch synced`, {
            totalEvents: result.totalEvents,
            processed: result.processed,
            skipped: result.skipped,
            duration_ms: result.duration_ms,
          })
        },
        onError: (error) => {
          log(`${KGS_SYNC_LOG_PREFIX} Sync error: ${error}`)
        },
      })
      log(`${KGS_SYNC_LOG_PREFIX} Adapter initialized`)
    }
    return adapter
  }

  return {
    "tool.execute.after": async (
      input: { tool: string; sessionID: string; callID: string },
      output: { title: string; output: string; metadata: Record<string, unknown> },
    ) => {
      if (!FILE_WRITE_TOOLS.has(input.tool)) return

      const filePath = extractFilePath(input, output)
      if (!filePath) {
        log(`${KGS_SYNC_LOG_PREFIX} No file path extracted`, { tool: input.tool })
        return
      }

      try {
        const syncAdapter = getAdapter()
        const changeType = inferChangeType(input.tool)
        const projectRoot = typeof _ctx.directory === "string" ? _ctx.directory : process.cwd()
        syncAdapter.onFileChange(filePath, changeType, projectRoot)
      } catch (error) {
        log(`${KGS_SYNC_LOG_PREFIX} Unexpected error`, { error })
      }
    },
  }
}
