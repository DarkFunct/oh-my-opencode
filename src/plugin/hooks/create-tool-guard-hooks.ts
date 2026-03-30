import type { HookName, OhMyOpenCodeConfig } from "../../config"
import type { ModelCacheState } from "../../plugin-state"
import type { PluginContext } from "../types"

import {
  createCommentCheckerHooks,
  createToolOutputTruncatorHook,
  createDirectoryAgentsInjectorHook,
  createDirectoryReadmeInjectorHook,
  createEmptyTaskResponseDetectorHook,
  createRulesInjectorHook,
  createTasksTodowriteDisablerHook,
  createWriteExistingFileGuardHook,
  createHashlineReadEnhancerHook,
  createReadImageResizerHook,
  createJsonErrorRecoveryHook,
  createTodoDescriptionOverrideHook,
  createWebFetchRedirectGuardHook,
  createMethodologyChainAuditHook,
  createBehavioralGovernanceHook,
  createKGSGuardHook,
  createKGSSyncHook,
  createMethodologyPhaseTrackerHook,
  createTaskLifecycleEnforcerHook,
  createPreFlightGuardHook,
  createPostExecutionVerifierHook,
  createRetrospectiveTriggerHook,
  createSessionEvidenceCollectorHook,
  createFixLifecycleGateHook,
  createKnowledgeProtectionHook,
  createToolAbortRecoveryHook,
  createTaskHealthHook,
  createWriteSizeGuardHook,
} from "../../hooks"
import {
  getOpenCodeVersion,
  isOpenCodeVersionAtLeast,
  log,
  OPENCODE_NATIVE_AGENTS_INJECTION_VERSION,
} from "../../shared"
import { safeCreateHook } from "../../shared/safe-create-hook"

export type ToolGuardHooks = {
  commentChecker: ReturnType<typeof createCommentCheckerHooks> | null
  toolOutputTruncator: ReturnType<typeof createToolOutputTruncatorHook> | null
  directoryAgentsInjector: ReturnType<typeof createDirectoryAgentsInjectorHook> | null
  directoryReadmeInjector: ReturnType<typeof createDirectoryReadmeInjectorHook> | null
  emptyTaskResponseDetector: ReturnType<typeof createEmptyTaskResponseDetectorHook> | null
  rulesInjector: ReturnType<typeof createRulesInjectorHook> | null
  tasksTodowriteDisabler: ReturnType<typeof createTasksTodowriteDisablerHook> | null
  writeExistingFileGuard: ReturnType<typeof createWriteExistingFileGuardHook> | null
  hashlineReadEnhancer: ReturnType<typeof createHashlineReadEnhancerHook> | null
  jsonErrorRecovery: ReturnType<typeof createJsonErrorRecoveryHook> | null
  readImageResizer: ReturnType<typeof createReadImageResizerHook> | null
  todoDescriptionOverride: ReturnType<typeof createTodoDescriptionOverrideHook> | null
  webfetchRedirectGuard: ReturnType<typeof createWebFetchRedirectGuardHook> | null
  methodologyChainAudit: ReturnType<typeof createMethodologyChainAuditHook> | null
  behavioralGovernance: ReturnType<typeof createBehavioralGovernanceHook> | null
  kgsGuard: ReturnType<typeof createKGSGuardHook> | null
  kgsSync: ReturnType<typeof createKGSSyncHook> | null
  methodologyPhaseTracker: ReturnType<typeof createMethodologyPhaseTrackerHook> | null
  taskLifecycleEnforcer: ReturnType<typeof createTaskLifecycleEnforcerHook> | null
  preFlightGuard: ReturnType<typeof createPreFlightGuardHook> | null
  postExecutionVerifier: ReturnType<typeof createPostExecutionVerifierHook> | null
  retrospectiveTrigger: ReturnType<typeof createRetrospectiveTriggerHook> | null
  sessionEvidenceCollector: ReturnType<typeof createSessionEvidenceCollectorHook> | null
  fixLifecycleGate: ReturnType<typeof createFixLifecycleGateHook> | null
  knowledgeProtection: ReturnType<typeof createKnowledgeProtectionHook> | null
  toolAbortRecovery: ReturnType<typeof createToolAbortRecoveryHook> | null
  taskHealth: ReturnType<typeof createTaskHealthHook> | null
  writeSizeGuard: ReturnType<typeof createWriteSizeGuardHook> | null
}

export function createToolGuardHooks(args: {
  ctx: PluginContext
  pluginConfig: OhMyOpenCodeConfig
  modelCacheState: ModelCacheState
  isHookEnabled: (hookName: HookName) => boolean
  safeHookEnabled: boolean
}): ToolGuardHooks {
  const { ctx, pluginConfig, modelCacheState, isHookEnabled, safeHookEnabled } = args
  const safeHook = <T>(hookName: HookName, factory: () => T): T | null =>
    safeCreateHook(hookName, factory, { enabled: safeHookEnabled })

  const commentChecker = isHookEnabled("comment-checker")
    ? safeHook("comment-checker", () => createCommentCheckerHooks(pluginConfig.comment_checker))
    : null

  const toolOutputTruncator = isHookEnabled("tool-output-truncator")
    ? safeHook("tool-output-truncator", () =>
        createToolOutputTruncatorHook(ctx, {
          modelCacheState,
          experimental: pluginConfig.experimental,
        }))
    : null

  let directoryAgentsInjector: ReturnType<typeof createDirectoryAgentsInjectorHook> | null = null
  if (isHookEnabled("directory-agents-injector")) {
    const currentVersion = getOpenCodeVersion()
    const hasNativeSupport =
      currentVersion !== null && isOpenCodeVersionAtLeast(OPENCODE_NATIVE_AGENTS_INJECTION_VERSION)
    if (hasNativeSupport) {
      log("directory-agents-injector auto-disabled due to native OpenCode support", {
        currentVersion,
        nativeVersion: OPENCODE_NATIVE_AGENTS_INJECTION_VERSION,
      })
    } else {
      directoryAgentsInjector = safeHook("directory-agents-injector", () =>
        createDirectoryAgentsInjectorHook(ctx, modelCacheState))
    }
  }

  const directoryReadmeInjector = isHookEnabled("directory-readme-injector")
    ? safeHook("directory-readme-injector", () =>
        createDirectoryReadmeInjectorHook(ctx, modelCacheState))
    : null

  const emptyTaskResponseDetector = isHookEnabled("empty-task-response-detector")
    ? safeHook("empty-task-response-detector", () => createEmptyTaskResponseDetectorHook(ctx))
    : null

  const rulesInjector = isHookEnabled("rules-injector")
    ? safeHook("rules-injector", () =>
        createRulesInjectorHook(ctx, modelCacheState))
    : null

  const tasksTodowriteDisabler = isHookEnabled("tasks-todowrite-disabler")
    ? safeHook("tasks-todowrite-disabler", () =>
        createTasksTodowriteDisablerHook({ experimental: pluginConfig.experimental }))
    : null

  const writeExistingFileGuard = isHookEnabled("write-existing-file-guard")
    ? safeHook("write-existing-file-guard", () => createWriteExistingFileGuardHook(ctx))
    : null

  const hashlineReadEnhancer = isHookEnabled("hashline-read-enhancer")
    ? safeHook("hashline-read-enhancer", () => createHashlineReadEnhancerHook(ctx, { hashline_edit: { enabled: pluginConfig.hashline_edit ?? false } }))
    : null

  const jsonErrorRecovery = isHookEnabled("json-error-recovery")
    ? safeHook("json-error-recovery", () => createJsonErrorRecoveryHook(ctx))
    : null

  const readImageResizer = isHookEnabled("read-image-resizer")
    ? safeHook("read-image-resizer", () => createReadImageResizerHook(ctx))
    : null

  const todoDescriptionOverride = isHookEnabled("todo-description-override")
    ? safeHook("todo-description-override", () => createTodoDescriptionOverrideHook())
    : null

  const webfetchRedirectGuard = isHookEnabled("webfetch-redirect-guard")
    ? safeHook("webfetch-redirect-guard", () => createWebFetchRedirectGuardHook(ctx))
    : null

  const methodologyChainAudit = isHookEnabled("methodology-chain-audit")
    ? safeHook("methodology-chain-audit", () =>
        createMethodologyChainAuditHook(ctx, {
          minOutputLengthForAudit:
            pluginConfig.cognitive_governance?.methodology_chain_audit?.min_output_length_for_audit,
        }))
    : null

  const behavioralGovernance = isHookEnabled("behavioral-governance")
    ? safeHook("behavioral-governance", () =>
        createBehavioralGovernanceHook(ctx, {
          ratioThreshold: pluginConfig.cognitive_governance?.behavioral_governance?.ratio_threshold,
          checkpointInterval: pluginConfig.cognitive_governance?.behavioral_governance?.checkpoint_interval,
          minBashSamplesForRatioGate:
            pluginConfig.cognitive_governance?.behavioral_governance?.min_bash_samples_for_ratio_gate,
          cognitiveMarkersThreshold:
            pluginConfig.cognitive_governance?.behavioral_governance?.cognitive_markers_threshold,
          dangerousCommandConfig: pluginConfig.cognitive_governance?.dangerous_command,
        }))
    : null

  const kgsGuard = isHookEnabled("kgs-guard")
    ? safeHook("kgs-guard", () => createKGSGuardHook(ctx))
    : null

  const methodologyPhaseTracker = isHookEnabled("methodology-phase-tracker")
    ? safeHook("methodology-phase-tracker", () =>
        createMethodologyPhaseTrackerHook(ctx, {
          captureReminderThreshold:
            pluginConfig.cognitive_governance?.methodology_phase_tracker?.capture_reminder_threshold,
          executeWithoutReadThreshold:
            pluginConfig.cognitive_governance?.methodology_phase_tracker?.execute_without_read_threshold,
          reminderCooldownSeconds:
            pluginConfig.cognitive_governance?.methodology_phase_tracker?.reminder_cooldown_seconds,
        }))
    : null

  const taskLifecycleEnforcer = isHookEnabled("task-lifecycle-enforcer")
    ? safeHook("task-lifecycle-enforcer", () =>
        createTaskLifecycleEnforcerHook(ctx, {
          editWriteBeforeTaskReminder:
            pluginConfig.cognitive_governance?.task_lifecycle_enforcer?.edit_write_before_task_reminder,
          reminderCooldownSeconds:
            pluginConfig.cognitive_governance?.task_lifecycle_enforcer?.reminder_cooldown_seconds,
        }))
    : null

  const preFlightGuard = isHookEnabled("pre-flight-guard")
    ? safeHook("pre-flight-guard", () =>
        createPreFlightGuardHook(ctx, {
          minReadBeforeExecute:
            pluginConfig.cognitive_governance?.pre_flight_guard?.min_read_before_execute,
          graceWindowSeconds:
            pluginConfig.cognitive_governance?.pre_flight_guard?.grace_window_seconds,
        }))
    : null

  const postExecutionVerifier = isHookEnabled("post-execution-verifier")
    ? safeHook("post-execution-verifier", () =>
        createPostExecutionVerifierHook(ctx, {
          verificationReminderInterval:
            pluginConfig.cognitive_governance?.post_execution_verifier?.verification_reminder_interval,
          reminderCooldownSeconds:
            pluginConfig.cognitive_governance?.post_execution_verifier?.reminder_cooldown_seconds,
        }))
    : null

  const retrospectiveTrigger = isHookEnabled("retrospective-trigger")
    ? safeHook("retrospective-trigger", () => createRetrospectiveTriggerHook(ctx))
    : null

  const sessionEvidenceCollector = isHookEnabled("session-evidence-collector")
    ? safeHook("session-evidence-collector", () =>
        createSessionEvidenceCollectorHook(ctx, {
          docMaintenanceConfig: {
            enabled: pluginConfig.cognitive_governance?.documentation_auto_management?.enabled,
            docsRoot: pluginConfig.cognitive_governance?.documentation_auto_management?.docs_root,
            registryFile: pluginConfig.cognitive_governance?.documentation_auto_management?.registry_file,
            maxReportItems: pluginConfig.cognitive_governance?.documentation_auto_management?.max_report_items,
          },
          secretScanConfig: pluginConfig.cognitive_governance?.secret_scan,
        }))
    : null

  const fixLifecycleGate = isHookEnabled("fix-lifecycle-gate")
    ? safeHook("fix-lifecycle-gate", () =>
		createFixLifecycleGateHook(ctx, {
			configOverrides: {
				repeatFixThreshold:
					pluginConfig.cognitive_governance?.fix_lifecycle_gate?.repeat_fix_threshold,
				sameFileFixThreshold:
					pluginConfig.cognitive_governance?.fix_lifecycle_gate?.same_file_fix_threshold,
				captureHardBlockThreshold:
					pluginConfig.cognitive_governance?.fix_lifecycle_gate?.capture_hard_block_threshold,
				executeActivityThreshold:
					pluginConfig.cognitive_governance?.fix_lifecycle_gate?.execute_activity_threshold,
				f3BlockThreshold:
					pluginConfig.cognitive_governance?.fix_lifecycle_gate?.f3_block_threshold,
				f2f4BlockThreshold:
					pluginConfig.cognitive_governance?.fix_lifecycle_gate?.f2_f4_block_threshold,
				dvWarningThreshold:
					pluginConfig.cognitive_governance?.delivery_verification?.dv_warning_threshold,
				caTrigggerFailures:
					pluginConfig.cognitive_governance?.causal_analysis?.ca_trigger_failures,
				caRequiredReadsBeforeRetry:
					pluginConfig.cognitive_governance?.causal_analysis?.ca_required_reads_before_retry,
			},
          gateResponseConfig: {
            hardBlockThreshold: pluginConfig.cognitive_governance?.gate_response?.hard_block_threshold,
            abortThreshold: pluginConfig.cognitive_governance?.gate_response?.abort_threshold,
          },
          methodologyCoverageConfig: pluginConfig.cognitive_governance?.methodology_coverage,
          batchClassificationConfig: pluginConfig.cognitive_governance?.batch_classification,
        }))
    : null

  const kgsSync = isHookEnabled("kgs-sync")
    ? safeHook("kgs-sync", () => createKGSSyncHook(ctx))
    : null

  const knowledgeProtection = isHookEnabled("knowledge-protection")
    ? safeHook("knowledge-protection", () => createKnowledgeProtectionHook(ctx))
    : null

  const toolAbortRecovery = isHookEnabled("tool-abort-recovery")
    ? safeHook("tool-abort-recovery", () => createToolAbortRecoveryHook(ctx))
    : null

  const taskHealth = isHookEnabled("task-health")
    ? safeHook("task-health", () => createTaskHealthHook(ctx))
    : null

  const writeSizeGuard = isHookEnabled("write-size-guard")
    ? safeHook("write-size-guard", () =>
        createWriteSizeGuardHook(ctx, {
          maxLines: pluginConfig.cognitive_governance?.write_size_guard?.max_lines,
          enabled: pluginConfig.cognitive_governance?.write_size_guard?.enabled,
        }))
    : null

  return {
    commentChecker,
    toolOutputTruncator,
    directoryAgentsInjector,
    directoryReadmeInjector,
    emptyTaskResponseDetector,
    rulesInjector,
    tasksTodowriteDisabler,
    writeExistingFileGuard,
    hashlineReadEnhancer,
    jsonErrorRecovery,
    readImageResizer,
    todoDescriptionOverride,
    webfetchRedirectGuard,
    methodologyChainAudit,
    behavioralGovernance,
    kgsGuard,
    methodologyPhaseTracker,
    taskLifecycleEnforcer,
    preFlightGuard,
    postExecutionVerifier,
    retrospectiveTrigger,
    sessionEvidenceCollector,
    fixLifecycleGate,
    kgsSync,
    knowledgeProtection,
    toolAbortRecovery,
    taskHealth,
    writeSizeGuard,
  }
}
