// 软性提醒门控提示词 (Soft/Non-blocking Gate Prompts — Tier 3 injections)
// 认知治理软提示：维度缺失、错误引导、验证提醒、Capture 升级

// 认知指令头部 (Cognitive Directive Header)
export function cognitiveDirectiveHeader(layer: string, dimensionsCovered: string): string {
	const layerLabel = LAYER_LABELS_EN[layer] ?? layer
	return [
		"[Harness Cognitive Governance — Current State]",
		`Cognitive layer: ${layerLabel}`,
		`Methodology coverage: ${dimensionsCovered || "none"}`,
	].join("\n")
}

// 维度缺失提醒 (Dimension Gap Reminder)
export function dimensionGapReminder(covered: string[], gap: string[]): string {
	return [
		"⚠️ Methodology Coverage Insufficient",
		`Covered: ${covered.join(", ")}`,
		`Missing: ${gap.slice(0, 3).join(", ")}`,
	].join("\n")
}

export function dimensionGapActionGuide(dimension: string, description: string, targets: string[]): string {
	const lines = [`- **${dimension}** (${description}):`]
	for (const target of targets) {
		lines.push(`    → ${target}`)
	}
	return lines.join("\n")
}

export function dimensionGapFooter(): string {
	return "Complete any missing dimension's actions above, and coverage will update automatically."
}

// 错误引导 (Error Guidance)
export function errorGuidance(unresolvedErrors: number, fixAttempts: number): string {
	return [
		"⚠️ Unresolved Errors Persist",
		`Errors: ${unresolvedErrors}, Fix attempts: ${fixAttempts}`,
		"Return to perception layer to re-gather evidence. Stop fixing symptoms repeatedly.",
	].join("\n")
}

// 验证提醒 (Verification Reminder)
export function verificationReminder(pendingCount: number): string {
	return [
		"📋 Verification Reminder",
		`${pendingCount} verifiable edit(s) have not been validated via build/test.`,
		"Rationality layer requires: return to perception layer to verify results after execution.",
	].join("\n")
}

// Capture 升级 (Capture Escalation)
export function captureCritical(editedFilesCount: number): string {
	return [
		"🚨 **Capture Phase CRITICALLY Overdue — Block Imminent**",
		`${editedFilesCount} files edited, but methodology chain Capture phase NOT executed.`,
		"Next round WILL trigger L2 hard block, prohibiting ALL non-Capture operations.",
		"**Execute IMMEDIATELY** — write knowledge artifacts to _meta/knowledge/:",
		"  • Lessons learned (L-xxx): lessons-learned.md — problem → diagnosis → fix → distillation",
		"  • Known pitfalls (P-xxx): pitfalls.md — symptom → root cause → fix",
		"  • Architecture decisions (D-xxx): decisions.md — context → options → rationale",
		"  • Constraints (C-xxx): constraints.md — constraint → level → source",
	].join("\n")
}

export function captureWarning(editedFilesCount: number): string {
	return [
		"⚠️ **Capture Phase Overdue**",
		`${editedFilesCount} files edited, Capture not executed.`,
		"Methodology chain: Read → Plan → Execute → **Capture (knowledge capture)**",
		"Write to _meta/knowledge/ soon: lessons (L-xxx) / pitfalls (P-xxx) / decisions (D-xxx) / constraints (C-xxx).",
	].join("\n")
}

export function captureNudge(editedFilesCount: number): string {
	return [
		"📝 Capture Reminder",
		`Execute phase has produced substantive changes (${editedFilesCount} files).`,
		"Remember to enter Capture phase (knowledge capture) after completing current work.",
		"Capture dimensions: lessons (L-xxx) / pitfalls (P-xxx) / decisions (D-xxx) / constraints (C-xxx).",
	].join("\n")
}

// F2 警告 (F2 Warning — Fix Direction Mismatch)
export function f2WarnZeroOverlap(errorFiles: string[], editedFiles: string[]): string {
	const errList = errorFiles.slice(0, 3).join(", ")
	const editList = editedFiles.slice(0, 3).join(", ")
	return (
		`[⚠️ F2: Fix Direction Mismatch] Errors originate from ${errList}, ` +
		`but you are editing ${editList}. Verify your causal chain is correct.`
	)
}

export function f2WarnPartialOverlap(errorFiles: string[], pct: number): string {
	const errList = errorFiles.slice(0, 3).join(", ")
	return (
		`[⚠️ F2: Fix Direction Partial Mismatch] Errors originate from ${errList}, ` +
		`but only ${pct}% of your edits overlap with error sources. Confirm remaining edits are relevant.`
	)
}

// F3 警告 (F3 Warning — Unverified Changes)
export function f3Warn(editCount: number): string {
	return (
		`[⚠️ F3: Unverified Changes] ${editCount} files edited without running verification. ` +
		`You MUST run lsp_diagnostics or typecheck to confirm no regressions.`
	)
}

// F4 警告 (F4 Warning — Knowledge Blindspot)
export function f4WarnAfterFailure(): string {
	return (
		"[⚠️ F4: Knowledge Blindspot] Fix failed but you have NOT consulted the knowledge base. " +
		"You MUST read _meta/knowledge/pitfalls.md and lessons-learned.md to check for known solutions."
	)
}

export function f4WarnBeforeExecute(): string {
	return (
		"[⚠️ F4: Knowledge Blindspot] Entering Execute without consulting knowledge base. " +
		"You MUST read _meta/knowledge/pitfalls.md and constraints.md to check for known pitfalls."
	)
}

const LAYER_LABELS_EN: Record<string, string> = {
	perception: "Perception Layer",
	understanding: "Understanding Layer",
	rationality: "Rationality Layer",
}

export const SOFT_PROMPT = {
	cognitiveDirectiveHeader,
	dimensionGapReminder,
	dimensionGapActionGuide,
	dimensionGapFooter,
	errorGuidance,
	verificationReminder,
	captureCritical,
	captureWarning,
	captureNudge,
	f2WarnZeroOverlap,
	f2WarnPartialOverlap,
	f3Warn,
	f4WarnAfterFailure,
	f4WarnBeforeExecute,
}
