import type { GateSeverity } from "@gaia/omo-hooks"
import { log } from "../../shared"
import { INJECTION_PROMPT } from "../../config/gate-prompts"

export function shouldAbortSession(severity: GateSeverity): boolean {
	return severity === "abort"
}

export interface AbortContext {
	readonly sessionID: string
	readonly gateId: string
	readonly blockCount: number
	readonly responseCount: number
	readonly reason: string
}

export function buildAbortExplanation(ctx: AbortContext): string {
	return INJECTION_PROMPT.sessionAbortExplanation(ctx.gateId, ctx.responseCount, ctx.blockCount, ctx.reason)
}

export async function executeSessionAbort(
	ctx: { client: { session: { abort: (params: { path: { id: string } }) => Promise<unknown> } } },
	sessionID: string,
	abortContext?: AbortContext,
): Promise<void> {
	if (abortContext) {
		const explanation = buildAbortExplanation(abortContext)
		log("[fix-lifecycle-gate] Abort explanation", { sessionID, explanation })
	}
	try {
		await ctx.client.session.abort({ path: { id: sessionID } })
	} catch (err) {
		log("[fix-lifecycle-gate] session.abort failed (non-fatal)", { sessionID, error: err })
	}
}
