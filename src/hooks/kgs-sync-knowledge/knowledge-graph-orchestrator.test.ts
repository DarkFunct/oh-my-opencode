declare const require: (name: string) => {
  describe: (name: string, fn: () => void) => void
  expect: (value: unknown) => {
    toBe: (expected: unknown) => void
    toContain: (expected: string) => void
  }
  it: (name: string, fn: () => Promise<void> | void) => void
}

const { describe, expect, it } = require("bun:test")

import type {
  KnowledgeDocumentIngestResponse,
  KnowledgeRetrieveContextResponse,
} from "@gaia/kgs-middleware"

import { KnowledgeGraphOrchestrator } from "./knowledge-graph-orchestrator"

function createIngestResponse(ok: boolean): KnowledgeDocumentIngestResponse {
  return {
    ok,
    scanned: 1,
    parsed: 1,
    assertionsExtracted: 1,
    assertionsIngested: ok ? 1 : 0,
    entitiesCreated: ok ? 1 : 0,
    entitiesUpdated: 0,
    relationshipsCreated: ok ? 1 : 0,
    relationshipsUpdated: 0,
    warnings: [],
    errors: ok ? [] : [{ item: "_meta/knowledge/pitfalls.md", error: "ingest failed" }],
    data_as_of: new Date().toISOString(),
  }
}

function createRetrieveResponse(): KnowledgeRetrieveContextResponse {
  return {
    ok: true,
    documentPath: "_meta/knowledge/pitfalls.md",
    extractedKeywords: ["kgs", "pitfall"],
    matchedEntities: [
      {
        id: "file:_meta/knowledge/pitfalls.md",
        type: "File",
        fqn: "_meta/knowledge/pitfalls.md",
        path: "_meta/knowledge/pitfalls.md",
        confidence: 1,
        matchReason: "path",
      },
    ],
    bundles: [],
    summary: {
      totalEntities: 1,
      totalRelationships: 2,
      riskHints: [],
    },
    warnings: [],
    data_as_of: new Date().toISOString(),
  }
}

describe("knowledge-graph-orchestrator", () => {
  it("skips ingest when mode is markdown_only", async () => {
    let ingestCalls = 0
    let enqueueCalls = 0

    const orchestrator = new KnowledgeGraphOrchestrator("/repo", {
      env: { KGS_KNOWLEDGE_MODE: "markdown_only" },
      createDocumentService: () => ({
        ingestDocument: async () => {
          ingestCalls += 1
          return createIngestResponse(true)
        },
      }),
      enqueueOutbox: async () => {
        enqueueCalls += 1
      },
      logger: () => {},
    })

    await orchestrator.ingestKnowledgeDocument("_meta/knowledge/pitfalls.md", {})

    expect(ingestCalls).toBe(0)
    expect(enqueueCalls).toBe(0)
  })

  it("uses explicit knowledgeConfig override over env", async () => {
    let ingestCalls = 0

    const orchestrator = new KnowledgeGraphOrchestrator("/repo", {
      env: { KGS_KNOWLEDGE_MODE: "dual" },
      knowledgeConfig: {
        mode: "markdown_only",
      },
      createDocumentService: () => ({
        ingestDocument: async () => {
          ingestCalls += 1
          return createIngestResponse(true)
        },
      }),
      logger: () => {},
    })

    await orchestrator.ingestKnowledgeDocument("_meta/knowledge/pitfalls.md", {})
    expect(ingestCalls).toBe(0)
  })

  it("queues outbox on ingest failure", async () => {
    let enqueueCalls = 0

    const orchestrator = new KnowledgeGraphOrchestrator("/repo", {
      env: { KGS_KNOWLEDGE_MODE: "dual" },
      createDocumentService: () => ({
        ingestDocument: async () => createIngestResponse(false),
      }),
      enqueueOutbox: async () => {
        enqueueCalls += 1
      },
      logger: () => {},
    })

    await orchestrator.ingestKnowledgeDocument("_meta/knowledge/pitfalls.md", {})

    expect(enqueueCalls).toBe(1)
  })

  it("replays outbox after successful ingest", async () => {
    let replayCalls = 0

    const orchestrator = new KnowledgeGraphOrchestrator("/repo", {
      env: { KGS_KNOWLEDGE_MODE: "dual" },
      createDocumentService: () => ({
        ingestDocument: async () => createIngestResponse(true),
      }),
      replayOutbox: async () => {
        replayCalls += 1
        return { replayed: 0, remaining: 0 }
      },
      logger: () => {},
    })

    await orchestrator.ingestKnowledgeDocument("_meta/knowledge/pitfalls.md", {})

    expect(replayCalls).toBe(1)
  })

  it("does not augment read output when read augmentation toggle is off", async () => {
    let retrieveCalls = 0
    const original = "1#abc12345|hello"

    const orchestrator = new KnowledgeGraphOrchestrator("/repo", {
      env: {
        KGS_KNOWLEDGE_MODE: "dual",
        KGS_KNOWLEDGE_READ_AUGMENT: "false",
      },
      createRetrievalService: () => ({
        retrieveContext: async () => {
          retrieveCalls += 1
          return createRetrieveResponse()
        },
      }),
      logger: () => {},
    })

    const output = await orchestrator.augmentReadOutput("_meta/knowledge/pitfalls.md", original)
    expect(output).toBe(original)
    expect(retrieveCalls).toBe(0)
  })

  it("appends kgs context block when read augmentation is enabled", async () => {
    const orchestrator = new KnowledgeGraphOrchestrator("/repo", {
      env: {
        KGS_KNOWLEDGE_MODE: "dual",
        KGS_KNOWLEDGE_READ_AUGMENT: "true",
      },
      createRetrievalService: () => ({
        retrieveContext: async () => createRetrieveResponse(),
      }),
      logger: () => {},
    })

    const output = await orchestrator.augmentReadOutput("_meta/knowledge/pitfalls.md", "1#abc12345|hello")
    expect(output).toContain("<kgs_context>")
    expect(output).toContain("document: _meta/knowledge/pitfalls.md")
  })
})
