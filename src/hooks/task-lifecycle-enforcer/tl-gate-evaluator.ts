import type { TaskLifecycleConfig, TaskLifecycleSessionState } from "./types"
import { parseTaskCompletionEvidence } from "./task-output-parser"
import {
	buildNoTaskCreatedReminder,
	buildTL02Warning,
	buildTL03Reminder,
	buildTL04Rejection,
} from "./prompts"

export interface GateResult {
	hardBlock?: string
	appendMessages: string[]
}

export function evaluateEditWriteGates(
	state: TaskLifecycleSessionState,
	config: TaskLifecycleConfig,
): GateResult {
	const result: GateResult = { appendMessages: [] }

	if (!state.hasCreatedTask && state.editWriteCallCount >= config.hardBlockThreshold) {
		result.hardBlock =
			`[TL-01] Hard block: ${state.editWriteCallCount} edit/write operations without creating a task. Use task_create first.`
		return result
	}

	const now = Date.now()
	const cooldownMs = config.reminderCooldownSeconds * 1000
	if (
		!state.hasCreatedTask &&
		state.editWriteCallCount >= config.editWriteBeforeTaskReminder &&
		now - state.lastReminderTime > cooldownMs
	) {
		result.appendMessages.push(buildNoTaskCreatedReminder(state))
	}

	if (state.hasCreatedTask && !state.hasInProgressTask) {
		result.appendMessages.push(buildTL02Warning())
	}

	if (
		state.hasInProgressTask &&
		state.editsSinceLastTaskUpdate >= config.statusUpdateReminderThreshold
	) {
		result.appendMessages.push(buildTL03Reminder(state.editsSinceLastTaskUpdate))
	}

	return result
}

export function evaluateCompletionGates(outputText: string): GateResult {
	const result: GateResult = { appendMessages: [] }
	const evidence = parseTaskCompletionEvidence(outputText)

	if (!evidence.hasDeliverables || !evidence.hasEvidence) {
		result.appendMessages.push(buildTL04Rejection())
		result.hardBlock = "TL-04"
	}

	return result
}
