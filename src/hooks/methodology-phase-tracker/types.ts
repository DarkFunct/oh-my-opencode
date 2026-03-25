/**
 * Methodology Phase Tracker — Type Definitions
 *
 * Tracks the main Agent's adherence to the four-phase methodology chain:
 * Read → Plan → Execute → Capture.
 *
 * Detects phase transitions by observing tool calls and injects
 * reminders when phases are skipped.
 */

export type MethodologyPhase = "idle" | "read" | "plan" | "execute" | "capture"

export interface PhaseTransition {
	from: MethodologyPhase
	to: MethodologyPhase
	timestamp: number
	toolTrigger: string
}

export interface MethodologySessionState {
	/** Current detected phase */
	currentPhase: MethodologyPhase
	/** Phases completed in current task cycle */
	completedPhases: Set<MethodologyPhase>
	/** Total tool calls since last phase reset */
	toolCallCount: number
	/** Number of execute-class tool calls (edit/write/bash) */
	executeCallCount: number
	/** Number of read-class tool calls */
	readCallCount: number
	/** Whether a task_create has been seen (signals multi-step work) */
	hasActiveTask: boolean
	/** Phase transition history (last 20) */
	transitions: PhaseTransition[]
	/** Last reminder injection timestamp (prevent spam) */
	lastReminderTime: number
}

export interface PhaseTrackerConfig {
	/** Minimum execute calls before Capture reminder triggers (default 5) */
	captureReminderThreshold: number
	/** Minimum seconds between reminder injections (default 60) */
	reminderCooldownSeconds: number
	/** Execute tool calls allowed before "Read first" reminder (default 3) */
	executeWithoutReadThreshold: number
}

export const DEFAULT_PHASE_TRACKER_CONFIG: PhaseTrackerConfig = {
	captureReminderThreshold: 5,
	reminderCooldownSeconds: 60,
	executeWithoutReadThreshold: 3,
}
