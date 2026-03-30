export interface FixLifecycleGateConfig {
  repeatFixThreshold: number
  sameFileFixThreshold: number
  captureHardBlockThreshold: number
  executeActivityThreshold: number
  f3BlockThreshold: number
  f2f4BlockThreshold: number
  dvWarningThreshold: number
  caTrigggerFailures: number
  caRequiredReadsBeforeRetry: number
}

export const DEFAULT_FIX_LIFECYCLE_GATE_CONFIG: FixLifecycleGateConfig = {
  repeatFixThreshold: 3,
  sameFileFixThreshold: 2,
  captureHardBlockThreshold: 4,
  executeActivityThreshold: 3,
  f3BlockThreshold: 5,
  f2f4BlockThreshold: 3,
  dvWarningThreshold: 2,
  caTrigggerFailures: 2,
  caRequiredReadsBeforeRetry: 3,
}
