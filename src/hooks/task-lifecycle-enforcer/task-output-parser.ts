interface ParsedTaskOutput {
	id: string | undefined
	status: string | undefined
}

interface ParsedTaskError {
	error: string
	message?: string
}

export interface TaskCompletionEvidence {
	hasDeliverables: boolean
	hasEvidence: boolean
}

export function extractTaskId(output: string): string | undefined {
	return parseTaskOutput(output).id
}

export function parseTaskOutput(output: string): ParsedTaskOutput {
	try {
		const parsed = JSON.parse(output)
		const task = parsed?.task
		if (!task || typeof task !== "object") {
			return { id: undefined, status: undefined }
		}
		return {
			id: typeof task.id === "string" ? task.id : undefined,
			status: typeof task.status === "string" ? task.status : undefined,
		}
	} catch {
		return { id: undefined, status: undefined }
	}
}

export function parseTaskCompletionEvidence(output: string): TaskCompletionEvidence {
	try {
		const parsed = JSON.parse(output)
		const task = parsed?.task
		if (!task || typeof task !== "object") {
			return { hasDeliverables: false, hasEvidence: false }
		}
		const deliverables = task.deliverables
		const evidence = task.evidence
		return {
			hasDeliverables: Array.isArray(deliverables) && deliverables.length > 0,
			hasEvidence: evidence != null && typeof evidence === "object" && Object.keys(evidence).length > 0,
		}
	} catch {
		return { hasDeliverables: false, hasEvidence: false }
	}
}

export function parseTaskError(output: string): ParsedTaskError | null {
	try {
		const parsed = JSON.parse(output)
		if (!parsed || typeof parsed !== "object") {
			return null
		}

		const error = (parsed as { error?: unknown }).error
		const message = (parsed as { message?: unknown }).message
		if (typeof error !== "string") {
			return null
		}

		return {
			error,
			message: typeof message === "string" ? message : undefined,
		}
	} catch {
		return null
	}
}
