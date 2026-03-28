import {
  DocumentKnowledgeService,
  KnowledgeRetrievalService,
} from "@gaia/kgs-middleware"

import { getKGSService } from "../../features/kgs"
import { log } from "../../shared"
import { formatKnowledgeContextBlock } from "./context-block"
import {
  enqueueKnowledgeOutbox,
  replayKnowledgeOutbox,
  type KnowledgeOutboxRecord,
} from "./knowledge-outbox"
import {
  resolveKnowledgeRuntimeConfig,
  type KnowledgeRuntimeConfig,
  type KnowledgeRuntimeOverrides,
} from "./knowledge-mode"
import { extractReadText } from "./read-output-parser"
const KNOWLEDGE_LOG_PREFIX = "[kgs-sync:knowledge]"

type IngestProvenance = {
  sessionID?: string
  tool?: string
  callID?: string
  agent?: string
}
type Logger = (message: string, context?: Record<string, unknown>) => void
type DocumentServiceLike = Pick<DocumentKnowledgeService, "ingestDocument">
type RetrievalServiceLike = Pick<KnowledgeRetrievalService, "retrieveContext">

interface KnowledgeGraphOrchestratorDeps {
  env?: NodeJS.ProcessEnv
  knowledgeConfig?: KnowledgeRuntimeOverrides
  now?: () => string
  createDocumentService?: () => DocumentServiceLike
  createRetrievalService?: () => RetrievalServiceLike
  enqueueOutbox?: typeof enqueueKnowledgeOutbox
  replayOutbox?: typeof replayKnowledgeOutbox
  logger?: Logger
}
export class KnowledgeGraphOrchestrator {
  private documentService: DocumentServiceLike | null = null
  private retrievalService: RetrievalServiceLike | null = null
  private readonly runtimeConfig: KnowledgeRuntimeConfig
  private readonly now: () => string
  private readonly createDocumentService: () => DocumentServiceLike
  private readonly createRetrievalService: () => RetrievalServiceLike
  private readonly enqueueOutbox: typeof enqueueKnowledgeOutbox
  private readonly replayOutboxFn: typeof replayKnowledgeOutbox
  private readonly logger: Logger
  constructor(private readonly projectRoot: string, deps: KnowledgeGraphOrchestratorDeps = {}) {
    this.runtimeConfig = resolveKnowledgeRuntimeConfig({
      env: deps.env,
      override: deps.knowledgeConfig,
    })
    this.now = deps.now ?? (() => new Date().toISOString())
    this.createDocumentService = deps.createDocumentService ?? (() => new DocumentKnowledgeService(getKGSService()))
    this.createRetrievalService = deps.createRetrievalService ?? (() => new KnowledgeRetrievalService(getKGSService()))
    this.enqueueOutbox = deps.enqueueOutbox ?? enqueueKnowledgeOutbox
    this.replayOutboxFn = deps.replayOutbox ?? replayKnowledgeOutbox
    this.logger = deps.logger ?? ((message, context) => log(message, context))

    this.logger(`${KNOWLEDGE_LOG_PREFIX} runtime config`, {
      mode: this.runtimeConfig.mode,
      readSourceMode: this.runtimeConfig.readSourceMode,
      readAugmentEnabled: this.runtimeConfig.readAugmentEnabled,
      writeIngestEnabled: this.runtimeConfig.writeIngestEnabled,
      outboxReplayEnabled: this.runtimeConfig.outboxReplayEnabled,
    })
  }
  private getDocumentService(): DocumentServiceLike {
    if (!this.documentService) {
      this.documentService = this.createDocumentService()
    }
    return this.documentService
  }
  private getRetrievalService(): RetrievalServiceLike {
    if (!this.retrievalService) {
      this.retrievalService = this.createRetrievalService()
    }
    return this.retrievalService
  }

  async augmentReadOutput(documentPath: string, toolOutput: string): Promise<string> {
    if (this.runtimeConfig.readSourceMode === "local_only") {
      return toolOutput
    }
    const readText = extractReadText(toolOutput)
    if (readText.trim().length === 0) {
      return toolOutput
    }

    try {
      const response = await this.getRetrievalService().retrieveContext({
        documentPath,
        readText,
      })
      this.logger(`${KNOWLEDGE_LOG_PREFIX} read context augmented`, {
        documentPath,
        matchedEntities: response.matchedEntities.length,
        relationships: response.summary.totalRelationships,
        warnings: response.warnings.length,
        readSourceMode: this.runtimeConfig.readSourceMode,
      })
      const contextBlock = formatKnowledgeContextBlock(response)
      if (this.runtimeConfig.readSourceMode === "kgs_only") {
        return contextBlock
      }
      return `${toolOutput}\n\n${contextBlock}`
    } catch (error: unknown) {
      this.logger(`${KNOWLEDGE_LOG_PREFIX} read augmentation failed`, {
        documentPath,
        readSourceMode: this.runtimeConfig.readSourceMode,
        error: error instanceof Error ? error.message : String(error),
      })
      return toolOutput
    }
  }

  async ingestKnowledgeDocument(documentPath: string, provenance: IngestProvenance): Promise<void> {
    if (!this.runtimeConfig.writeIngestEnabled) {
      this.logger(`${KNOWLEDGE_LOG_PREFIX} ingest skipped by mode`, {
        documentPath,
        mode: this.runtimeConfig.mode,
      })
      return
    }
    const writtenAt = this.now()

    try {
      const response = await this.getDocumentService().ingestDocument({
        documentPath,
        mode: this.runtimeConfig.mode,
        writtenAt,
        provenance,
      })
      if (!response.ok) {
        await this.enqueueOutbox(this.projectRoot, {
          documentPath,
          writtenAt,
          ...provenance,
        })
        this.logger(`${KNOWLEDGE_LOG_PREFIX} ingest failed, queued outbox`, {
          documentPath,
          mode: this.runtimeConfig.mode,
          errors: response.errors,
        })
        return
      }
      this.logger(`${KNOWLEDGE_LOG_PREFIX} ingest succeeded`, {
        documentPath,
        mode: this.runtimeConfig.mode,
        assertionsIngested: response.assertionsIngested,
        entitiesCreated: response.entitiesCreated,
        relationshipsCreated: response.relationshipsCreated,
      })
      await this.replayOutbox()
    } catch (error: unknown) {
      await this.enqueueOutbox(this.projectRoot, {
        documentPath,
        writtenAt,
        ...provenance,
      })
      this.logger(`${KNOWLEDGE_LOG_PREFIX} ingest exception, queued outbox`, {
        documentPath,
        mode: this.runtimeConfig.mode,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  async replayOutbox(): Promise<void> {
    if (!this.runtimeConfig.outboxReplayEnabled) {
      return
    }
    const result = await this.replayOutboxFn(this.projectRoot, async (record) => this.processOutboxRecord(record))
    if (result.replayed > 0 || result.remaining > 0) {
      this.logger(`${KNOWLEDGE_LOG_PREFIX} outbox replay complete`, result)
    }
  }

  private async processOutboxRecord(record: KnowledgeOutboxRecord): Promise<boolean> {
    try {
      const response = await this.getDocumentService().ingestDocument({
        documentPath: record.documentPath,
        mode: "dual",
        writtenAt: record.writtenAt,
        provenance: {
          sessionID: record.sessionID,
          tool: record.tool,
          callID: record.callID,
          agent: record.agent,
        },
      })
      return response.ok
    } catch (error: unknown) {
      this.logger(`${KNOWLEDGE_LOG_PREFIX} outbox replay item failed`, {
        documentPath: record.documentPath,
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }
}
