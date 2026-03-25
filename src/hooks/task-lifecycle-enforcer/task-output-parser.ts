interface ParsedTaskOutput {
	id: string | undefined
	status: string | undefined
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
