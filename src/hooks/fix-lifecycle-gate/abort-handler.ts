import type { GateSeverity } from "@gaia/omo-hooks"
import { log } from "../../shared"

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
	return [
		"[🛑 Session Abort — 终止说明]",
		"",
		`门控 ${ctx.gateId} 经过 ${ctx.responseCount} 次响应尝试后仍未解除。`,
		`累计阻断: ${ctx.blockCount} 次`,
		`终止原因: ${ctx.reason}`,
		"",
		"如需继续此任务，请在新会话中先完成门控要求的认知操作。",
	].join("\n")
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
