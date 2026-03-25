export interface TaskLifecycleSessionState {
	hasCreatedTask: boolean
	editWriteCallCount: number
	taskCompletedCount: number
	lastReminderTime: number
	activeTaskIds: Set<string>
}

export interface TaskLifecycleConfig {
	editWriteBeforeTaskReminder: number
	reminderCooldownSeconds: number
}

export const DEFAULT_TASK_LIFECYCLE_CONFIG: TaskLifecycleConfig = {
	editWriteBeforeTaskReminder: 2,
	reminderCooldownSeconds: 90,
}
