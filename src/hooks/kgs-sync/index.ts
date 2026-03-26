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
  flushAndDispose(): Promise<void>
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

function extractFilePathFromArgs(args: Record<string, unknown>): string | null {
  const candidate = args.filePath ?? args.file_path ?? args.path ?? args.file
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null
}

function extractFilePathFromOutput(
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

function inferChangeType(tool: string): "create" | "modify" {
  if (tool === "Write" || tool === "write") return "create"
  return "modify"
}

export function createKGSSyncHook(_ctx: PluginInput) {
  let adapter: KGSSyncAdapter | null = null
  const pendingFilePaths = new Map<string, string>()

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
    "tool.execute.before": (
      input: { tool: string; callID?: string },
      output: { args: Record<string, unknown> },
    ) => {
      if (!FILE_WRITE_TOOLS.has(input.tool) || !input.callID) return
      const filePath = extractFilePathFromArgs(output.args)
      if (filePath) {
        pendingFilePaths.set(input.callID, filePath)
      }
    },

    "tool.execute.after": async (
      input: { tool: string; sessionID: string; callID: string },
      output: { title: string; output: string; metadata: Record<string, unknown> },
    ) => {
      if (!FILE_WRITE_TOOLS.has(input.tool)) return

      const pending = input.callID ? pendingFilePaths.get(input.callID) ?? null : null
      if (input.callID) pendingFilePaths.delete(input.callID)

      const filePath = extractFilePathFromOutput(pending, output)
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

    event: async (input: { event: { type: string; properties?: Record<string, unknown> } }) => {
      if (input.event.type !== "session.deleted") return
      if (!adapter) return

      try {
        log(`${KGS_SYNC_LOG_PREFIX} Session deleted — flushing pending writes`)
        await adapter.flushAndDispose()
        adapter = null
      } catch (error) {
        log(`${KGS_SYNC_LOG_PREFIX} Flush on session delete failed`, { error })
        try { adapter?.dispose(); } catch { /* best-effort cleanup */ }
        adapter = null
      }
    },
  }
}
