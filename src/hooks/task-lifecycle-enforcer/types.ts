export interface TaskLifecycleSessionState {
	hasCreatedTask: boolean
	editWriteCallCount: number
	taskCompletedCount: number
	lastReminderTime: number
	activeTaskIds: Set<string>
	hasInProgressTask: boolean
	editsSinceLastTaskUpdate: number
}

export interface TaskLifecycleConfig {
	editWriteBeforeTaskReminder: number
	reminderCooldownSeconds: number
	hardBlockThreshold: number
	statusUpdateReminderThreshold: number
}

export const DEFAULT_TASK_LIFECYCLE_CONFIG: TaskLifecycleConfig = {
	editWriteBeforeTaskReminder: 2,
	reminderCooldownSeconds: 90,
	hardBlockThreshold: 10,
	statusUpdateReminderThreshold: 8,
}
