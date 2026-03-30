import type { GateSeverity } from "@gaia/omo-hooks"
import { log } from "../../shared"

export function shouldAbortSession(severity: GateSeverity): boolean {
	return severity === "abort"
}

export async function executeSessionAbort(
	ctx: { client: { session: { abort: (params: { path: { id: string } }) => Promise<unknown> } } },
	sessionID: string,
): Promise<void> {
	try {
		await ctx.client.session.abort({ path: { id: sessionID } })
	} catch (err) {
		log("[fix-lifecycle-gate] session.abort failed (non-fatal)", { sessionID, error: err })
	}
}
