import { log } from "../../shared"

const LOG_PREFIX = "[kgs-guard:debounce]"

export interface PendingWriteCapture {
	filePath: string
	tool: string
	changeType: "create" | "modify" | "delete" | "rename"
	timestamp: number
}

export interface WriteCaptureBatch {
	sessionID: string
	files: PendingWriteCapture[]
}

interface SessionDebounceState {
	pending: PendingWriteCapture[]
	timer: ReturnType<typeof setTimeout> | null
}

const sessionDebouncers = new Map<string, SessionDebounceState>()

const WRITE_TOOLS = new Set(["edit", "write", "ast_grep_replace", "lsp_rename", "apply_patch"])

export function isWriteTool(tool: string): boolean {
	return WRITE_TOOLS.has(tool.toLowerCase())
}

function inferChangeType(tool: string): PendingWriteCapture["changeType"] {
	if (tool === "write") return "create"
	if (tool === "lsp_rename") return "rename"
	return "modify"
}

export function recordWriteForCapture(
	sessionID: string,
	tool: string,
	filePath: string | undefined,
	debounceMs: number,
	onFlush: (batch: WriteCaptureBatch) => void,
): void {
	if (!filePath) return

	let state = sessionDebouncers.get(sessionID)
	if (!state) {
		state = { pending: [], timer: null }
		sessionDebouncers.set(sessionID, state)
	}

	state.pending.push({
		filePath,
		tool: tool.toLowerCase(),
		changeType: inferChangeType(tool.toLowerCase()),
		timestamp: Date.now(),
	})

	if (state.timer) {
		clearTimeout(state.timer)
	}

	state.timer = setTimeout(() => {
		flushSession(sessionID, onFlush)
	}, debounceMs)
}

function flushSession(sessionID: string, onFlush: (batch: WriteCaptureBatch) => void): void {
	const state = sessionDebouncers.get(sessionID)
	if (!state || state.pending.length === 0) return

	const deduped = deduplicateByFile(state.pending)
	state.pending = []
	state.timer = null

	log(`${LOG_PREFIX} Flushing ${deduped.length} file(s)`, { sessionID })
	onFlush({ sessionID, files: deduped })
}

function deduplicateByFile(entries: PendingWriteCapture[]): PendingWriteCapture[] {
	const byPath = new Map<string, PendingWriteCapture>()
	for (const entry of entries) {
		byPath.set(entry.filePath, entry)
	}
	return Array.from(byPath.values())
}

export function cleanupSessionDebouncer(sessionID: string): void {
	const state = sessionDebouncers.get(sessionID)
	if (state?.timer) {
		clearTimeout(state.timer)
	}
	sessionDebouncers.delete(sessionID)
}
