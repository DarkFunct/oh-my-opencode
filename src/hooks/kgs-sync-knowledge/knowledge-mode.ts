export type KnowledgeMode = "dual" | "markdown_only"
export type KnowledgeReadSourceMode = "hybrid" | "local_only" | "kgs_only"

export interface KnowledgeRuntimeConfig {
  mode: KnowledgeMode
  readSourceMode: KnowledgeReadSourceMode
  readAugmentEnabled: boolean
  writeIngestEnabled: boolean
  outboxReplayEnabled: boolean
}

export interface KnowledgeRuntimeOverrides {
  mode?: KnowledgeMode
  read_source_mode?: KnowledgeReadSourceMode
  read_augment?: boolean
  outbox_replay?: boolean
}

function parseBoolean(raw: string | undefined, defaultValue: boolean): boolean {
  if (raw === undefined) return defaultValue
  const normalized = raw.trim().toLowerCase()
  if (["1", "true", "yes", "on"].includes(normalized)) return true
  if (["0", "false", "no", "off"].includes(normalized)) return false
  return defaultValue
}

function parseReadSourceMode(raw: string | undefined): KnowledgeReadSourceMode | undefined {
  if (raw === undefined) return undefined
  const normalized = raw.trim().toLowerCase()
  if (normalized === "hybrid" || normalized === "local_only" || normalized === "kgs_only") {
    return normalized
  }
  return undefined
}

export function resolveKnowledgeMode(env: NodeJS.ProcessEnv = process.env): KnowledgeMode {
  const raw = env.KGS_KNOWLEDGE_MODE?.trim().toLowerCase()
  return raw === "markdown_only" ? "markdown_only" : "dual"
}

export function resolveKnowledgeRuntimeConfig(input: {
  env?: NodeJS.ProcessEnv
  override?: KnowledgeRuntimeOverrides
} = {}): KnowledgeRuntimeConfig {
  const env = input.env ?? process.env
  const mode = input.override?.mode ?? resolveKnowledgeMode(env)
  const defaultDualEnabled = mode === "dual"

  const explicitReadSourceMode = input.override?.read_source_mode
    ?? parseReadSourceMode(env.KGS_KNOWLEDGE_READ_SOURCE_MODE)

  const readSourceMode = explicitReadSourceMode
    ?? ((input.override?.read_augment
      ?? parseBoolean(env.KGS_KNOWLEDGE_READ_AUGMENT, defaultDualEnabled))
      ? "hybrid"
      : "local_only")

  const readAugmentEnabled = readSourceMode !== "local_only"
  const outboxReplayEnabled = input.override?.outbox_replay
    ?? parseBoolean(env.KGS_KNOWLEDGE_OUTBOX_REPLAY, defaultDualEnabled)

  return {
    mode,
    readSourceMode,
    readAugmentEnabled,
    writeIngestEnabled: mode === "dual",
    outboxReplayEnabled,
  }
}
