interface ParsedTaskOutput {
	id: string | undefined
	status: string | undefined
}

interface ParsedTaskError {
	error: string
	message?: string
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
