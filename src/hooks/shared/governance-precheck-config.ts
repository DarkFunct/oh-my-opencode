import { readFileSync } from "node:fs"
import { join } from "node:path"
import { detectPluginConfigFile, parseJsonc } from "../../shared"
import {
  StartWorkConfigSchema,
  type StartWorkConfig,
} from "../../config/schema/start-work"

export interface GovernancePrecheckConfig {
  enabled: boolean
  baseUrl: string | null
  timeoutMs: number
  runtimePolicyVersion: string | null
}

function readProjectStartWorkConfig(directory: string): StartWorkConfig | null {
  const detected = detectPluginConfigFile(join(directory, ".opencode"))
  if (detected.format === "none") return null

  try {
    const raw = parseJsonc<Record<string, unknown>>(readFileSync(detected.path, "utf8"))
    const parsed = StartWorkConfigSchema.safeParse(raw.start_work ?? {})
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export function resolveGovernancePrecheckConfig(directory: string): GovernancePrecheckConfig {
  const startWorkConfig = readProjectStartWorkConfig(directory)
  const configuredUrl = startWorkConfig?.governance_precheck_url?.trim()
  const envUrl = process.env.GAIA_GOVERNANCE_PRECHECK_URL?.trim()
  const resolvedUrl = configuredUrl || envUrl || null

  return {
    enabled: startWorkConfig?.governance_precheck_enabled ?? true,
    baseUrl: resolvedUrl ? resolvedUrl.replace(/\/$/, "") : null,
    timeoutMs: startWorkConfig?.governance_precheck_timeout_ms ?? 5000,
    runtimePolicyVersion: startWorkConfig?.governance_runtime_policy_version?.trim() ?? null,
  }
}

export function governanceEndpoint(baseUrl: string, path: string): string {
  return `${baseUrl}/api/v1/governance/${path}`
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}
