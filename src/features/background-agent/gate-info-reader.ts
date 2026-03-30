import { readGateMetadata, readGateEvents } from "@gaia/omo-hooks"
import type { TaskGateMetadata, SubAgentGateEvent, ToolAbortEvent } from "@gaia/omo-hooks"
import { readFile } from "fs/promises"
import { join } from "path"
import { log } from "../../shared"

const GATE_METADATA_ROOT = ".sisyphus/gate-metadata"
const TOOL_ABORT_EVENTS_FILENAME = "tool-abort-events.json"

export interface SessionGateInfo {
	gateMetadata: TaskGateMetadata | null
	gateEvents: SubAgentGateEvent[]
	toolAbortEvents: ToolAbortEvent[]
}

function getGateDir(sessionID: string): string {
	return join(process.cwd(), GATE_METADATA_ROOT, sessionID)
}

export async function readSessionGateInfo(sessionID: string): Promise<SessionGateInfo> {
	const dir = getGateDir(sessionID)
	try {
		const [gateMetadata, gateEvents, toolAbortEvents] = await Promise.all([
			readGateMetadata(dir),
			readGateEvents(dir),
			readToolAbortEvents(dir),
		])
		return { gateMetadata, gateEvents, toolAbortEvents }
	} catch {
		return { gateMetadata: null, gateEvents: [], toolAbortEvents: [] }
	}
}

async function readToolAbortEvents(dir: string): Promise<ToolAbortEvent[]> {
	try {
		const raw = await readFile(join(dir, TOOL_ABORT_EVENTS_FILENAME), "utf-8")
		return JSON.parse(raw) as ToolAbortEvent[]
	} catch {
		return []
	}
}

export function formatGateInfoForNotification(info: SessionGateInfo): string {
	const parts: string[] = []

	if (info.gateMetadata) {
		const gr = info.gateMetadata.gateResponse
		parts.push(
			`\n**⚠️ Gate Block Detected:**`,
			`- Gate: \`${gr.gateId}\``,
			`- Severity: \`${gr.severity}\` (level ${gr.escalationLevel})`,
			`- Block Count: ${gr.blockCount}`,
			`- Reason: ${gr.reason}`,
			`- Recovery: ${gr.recoveryAction.slice(0, 200)}`,
		)
	}

	if (info.gateEvents.length > 0) {
		parts.push(`\n**Gate Events:** ${info.gateEvents.length} total`)
	}

	if (info.toolAbortEvents.length > 0) {
		const latest = info.toolAbortEvents[info.toolAbortEvents.length - 1]
		parts.push(
			`\n**Tool Abort Events:** ${info.toolAbortEvents.length} total`,
			`- Latest: \`${latest.toolName}\` (consecutive: ${latest.consecutiveCount})`,
		)
	}

	return parts.join("\n")
}

export async function getGateNotificationSuffix(sessionID: string): Promise<string> {
	try {
		const info = await readSessionGateInfo(sessionID)
		if (!info.gateMetadata && info.gateEvents.length === 0 && info.toolAbortEvents.length === 0) {
			return ""
		}
		return formatGateInfoForNotification(info)
	} catch (err) {
		log("[gate-info-reader] Failed to read gate info", { sessionID, error: err })
		return ""
	}
}
