import type { SubAgentGateEvent, GateSeverity } from "@gaia/omo-hooks"

export interface GateBlockResult {
	triggered: boolean
	gateInfo?: string
}

const SEVERE_SEVERITIES: ReadonlySet<GateSeverity> = new Set(["hard_block", "abort"])

export function shouldAbortForGateBlock(events: SubAgentGateEvent[], threshold: number): GateBlockResult {
	if (events.length === 0) return { triggered: false }

	let consecutiveCount = 0
	for (let i = events.length - 1; i >= 0; i--) {
		if (SEVERE_SEVERITIES.has(events[i].severity)) {
			consecutiveCount++
		} else {
			break
		}
	}

	if (consecutiveCount < threshold) return { triggered: false }

	const last = events[events.length - 1]
	return {
		triggered: true,
		gateInfo: `Gate ${last.gateId}: ${consecutiveCount} consecutive hard_block/abort events (threshold: ${threshold})`,
	}
}
