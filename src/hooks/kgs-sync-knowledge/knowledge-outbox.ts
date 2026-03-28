import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

export interface KnowledgeOutboxRecord {
  documentPath: string
  writtenAt: string
  sessionID?: string
  tool?: string
  callID?: string
  agent?: string
}

const OUTBOX_RELATIVE_PATH = ".sisyphus/kgs-knowledge-outbox.json"

function outboxPath(projectRoot: string): string {
  return path.join(projectRoot, OUTBOX_RELATIVE_PATH)
}

async function readRecords(projectRoot: string): Promise<KnowledgeOutboxRecord[]> {
  const filePath = outboxPath(projectRoot)
  try {
    const raw = await readFile(filePath, "utf-8")
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.filter((item): item is KnowledgeOutboxRecord => {
      if (!item || typeof item !== "object") return false
      const candidate = item as Partial<KnowledgeOutboxRecord>
      return typeof candidate.documentPath === "string" && typeof candidate.writtenAt === "string"
    })
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "ENOENT") {
      return []
    }
    return []
  }
}

async function writeRecords(projectRoot: string, records: KnowledgeOutboxRecord[]): Promise<void> {
  const filePath = outboxPath(projectRoot)
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(records, null, 2)}\n`, "utf-8")
}

export async function enqueueKnowledgeOutbox(projectRoot: string, record: KnowledgeOutboxRecord): Promise<void> {
  const records = await readRecords(projectRoot)
  records.push(record)
  await writeRecords(projectRoot, records)
}

export async function replayKnowledgeOutbox(
  projectRoot: string,
  processor: (record: KnowledgeOutboxRecord) => Promise<boolean>,
): Promise<{ replayed: number; remaining: number }> {
  const records = await readRecords(projectRoot)
  if (records.length === 0) return { replayed: 0, remaining: 0 }

  const remaining: KnowledgeOutboxRecord[] = []
  let replayed = 0

  for (const record of records) {
    const ok = await processor(record)
    if (ok) {
      replayed += 1
      continue
    }
    remaining.push(record)
  }

  await writeRecords(projectRoot, remaining)
  return { replayed, remaining: remaining.length }
}
