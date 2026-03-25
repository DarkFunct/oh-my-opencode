export interface PostExecutionSessionState {
	executeStepCount: number
	lastVerificationReminder: number
	filesModified: Set<string>
	bashCommandCount: number
}

export interface PostExecutionConfig {
	verificationReminderInterval: number
	reminderCooldownSeconds: number
}

export const DEFAULT_POST_EXECUTION_CONFIG: PostExecutionConfig = {
	verificationReminderInterval: 8,
	reminderCooldownSeconds: 120,
}
