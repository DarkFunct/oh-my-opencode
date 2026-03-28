import type { TaskObject, TaskStatus } from "./types"

export interface GranularityViolation {
  code: "granularity_requirements_missing"
  message: string
  missingFields: string[]
}

const REQUIRED_GRANULARITY_FIELDS = [
  "targetFile",
  "responsibility",
  "verificationUnit",
] as const

function isFilledString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0
}

export function validateGranularityForStatus(
  task: TaskObject,
  nextStatus: TaskStatus,
): GranularityViolation | null {
  if (nextStatus !== "in_progress") {
    return null
  }

  const metadata = task.metadata ?? {}
  const missingFields = REQUIRED_GRANULARITY_FIELDS.filter((field) => !isFilledString(metadata[field]))

  if (missingFields.length === 0) {
    return null
  }

  return {
    code: "granularity_requirements_missing",
    message:
      "Cannot move task to in_progress without single-file granularity metadata (targetFile/responsibility/verificationUnit)",
    missingFields,
  }
}
