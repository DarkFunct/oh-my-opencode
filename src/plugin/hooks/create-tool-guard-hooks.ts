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
    ? safeHook("methodology-chain-audit", () => createMethodologyChainAuditHook(ctx))
    : null

  const behavioralGovernance = isHookEnabled("behavioral-governance")
    ? safeHook("behavioral-governance", () => createBehavioralGovernanceHook(ctx))
    : null

  const kgsGuard = isHookEnabled("kgs-guard")
    ? safeHook("kgs-guard", () => createKGSGuardHook(ctx))
    : null

  const methodologyPhaseTracker = isHookEnabled("methodology-phase-tracker")
    ? safeHook("methodology-phase-tracker", () => createMethodologyPhaseTrackerHook(ctx))
    : null

  const taskLifecycleEnforcer = isHookEnabled("task-lifecycle-enforcer")
    ? safeHook("task-lifecycle-enforcer", () => createTaskLifecycleEnforcerHook(ctx))
    : null

  const preFlightGuard = isHookEnabled("pre-flight-guard")
    ? safeHook("pre-flight-guard", () => createPreFlightGuardHook(ctx))
    : null

  const postExecutionVerifier = isHookEnabled("post-execution-verifier")
    ? safeHook("post-execution-verifier", () => createPostExecutionVerifierHook(ctx))
    : null

  const retrospectiveTrigger = isHookEnabled("retrospective-trigger")
    ? safeHook("retrospective-trigger", () => createRetrospectiveTriggerHook(ctx))
    : null

  const sessionEvidenceCollector = isHookEnabled("session-evidence-collector")
    ? safeHook("session-evidence-collector", () => createSessionEvidenceCollectorHook(ctx))
    : null

  const fixLifecycleGate = isHookEnabled("fix-lifecycle-gate")
    ? safeHook("fix-lifecycle-gate", () => createFixLifecycleGateHook(ctx))
    : null

  const kgsSync = isHookEnabled("kgs-sync")
    ? safeHook("kgs-sync", () => createKGSSyncHook(ctx))
    : null

  const knowledgeProtection = isHookEnabled("knowledge-protection")
    ? safeHook("knowledge-protection", () => createKnowledgeProtectionHook(ctx))
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
  }
}
