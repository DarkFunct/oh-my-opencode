// 阻断型门控提示词 (Hard Blocking Gate Prompts)
// All messages use forceful English tone per user requirement.
// Each template includes: what's blocked, what's missing, how to unblock, example format.

// 批量分类门控 (Batch Classification Gate)
export function batchClassificationBlock(itemCount: number, threshold: number): string {
	return [
		`[🛑 Batch Classification Gate] BLOCKED — ${itemCount} todo items exceed threshold (${threshold}) without classification markers.`,
		"",
		"You MUST comply with this gate requirement. Add a classification prefix to EVERY todo item.",
		"",
		"What's missing: Each todo item MUST have a [Category] or (Category) prefix.",
		"How to unblock: Rewrite your todowrite call with classified items.",
		"",
		"Example format:",
		'  { content: "[Refactor] Extract auth logic into separate module", status: "pending", priority: "high" }',
		'  { content: "(Bugfix) Fix null pointer in session handler", status: "pending", priority: "high" }',
		"",
		"You MUST strictly follow this requirement! Resubmit with ALL items classified.",
	].join("\n")
}

// 预飞检查门控 (Pre-flight Read Check Gate)
export function preFlightReadBlock(): string {
	return [
		"[🛑 Pre-flight Guard] BLOCKED — Execute operation intercepted.",
		"",
		"You MUST read relevant files BEFORE making any modifications. This is non-negotiable.",
		"",
		"What's missing: No Read phase detected before this Execute action.",
		"Required chain: Read → Plan → Execute. You skipped Read.",
		"",
		"How to unblock:",
		"1. Use Read/Glob/Grep/LSP tools to examine relevant files",
		"2. Understand the current code state and context",
		"3. Formulate your modification plan",
		"4. THEN execute modifications",
		"",
		"Example: If modifying src/hooks/auth.ts, first run:",
		"  read('src/hooks/auth.ts')  → understand current implementation",
		"  grep('authMiddleware')     → find related usages",
		"",
		"This block triggers ONCE. After completing Read, you may proceed.",
		"You MUST strictly follow the methodology chain!",
	].join("\n")
}

// 写入大小门控 (Write Size Guard Gate)
export function writeSizeBlock(lineCount: number, maxLines: number): string {
	return [
		`[🛑 Write Size Guard] BLOCKED — Content exceeds line limit.`,
		"",
		`Current: ${lineCount} lines. Maximum allowed: ${maxLines} lines.`,
		"",
		"You MUST use incremental write strategy. Writing the entire file at once is FORBIDDEN.",
		"",
		"How to unblock — use chunked writing:",
		`1. Split content into chunks of < ${maxLines} lines each`,
		"2. First call: Use Write tool for the base portion of the file",
		"3. Subsequent calls: Use Edit tool to append remaining sections",
		"4. After each operation: Verify file integrity",
		"",
		"Example:",
		`  write('file.ts', first_${maxLines}_lines)   → base content`,
		"  edit('file.ts', oldString='// MORE', newString=next_chunk) → append",
		"",
		"You MUST strictly follow this requirement!",
	].join("\n")
}

// 重复修复门控 (Repeat Fix Gate)
export function repeatFixConsecutiveFailuresBlock(fixCount: number): string {
	return [
		"[🛑 Fix Lifecycle Gate] BLOCKED — Repeated fix failures detected.",
		"",
		`${fixCount} consecutive fix attempts have FAILED. Symptom-level fixing is not working.`,
		"",
		"You MUST stop the current fix path and take corrective action:",
		"1. STOP current fix approach — symptom fixes are ineffective when root cause is unknown",
		"2. REVERT to last known good state (git checkout / undo edits)",
		"3. RE-ENTER perception layer — use Read/Grep/LSP to re-gather evidence",
		"4. RECORD failure chain — write to _meta/knowledge/lessons-learned.md",
		"5. If needed — consult Oracle for architecture-level guidance",
		"",
		"Example recovery sequence:",
		"  bash('git diff HEAD~3')     → review what changed",
		"  read('failing-file.ts')     → re-examine from scratch",
		"  grep('errorPattern')        → trace error propagation",
		"",
		"You MUST strictly follow these steps! Do NOT retry the same approach.",
	].join("\n")
}

export function repeatFixSameFileBlock(target: string, fixCount: number): string {
	return [
		"[🛑 Fix Lifecycle Gate] BLOCKED — Same file modified repeatedly without resolution.",
		"",
		`File \`${target}\` has been modified ${fixCount} times but the error persists.`,
		"",
		"You MUST stop editing this file and reconsider your approach:",
		"1. STOP modifying this file — repeated edits without resolution indicate wrong diagnosis",
		"2. QUESTION your understanding — is your mental model of the problem correct?",
		"3. EXPAND perception scope — the root cause may be in a DIFFERENT file",
		"4. CONSIDER reverting — restore the file to its pre-modification state and re-analyze",
		"",
		"Example recovery:",
		"  bash('git checkout -- " + target + "')  → revert to original",
		"  grep('relatedSymbol')                    → search for root cause elsewhere",
		"  read('dependency-file.ts')               → check upstream dependencies",
		"",
		"You MUST strictly follow these steps!",
	].join("\n")
}

// Capture 逾期门控 (Capture Overdue Gate)
export function captureOverdueBlock(editedFiles: number, roundsPending: number): string {
	return [
		"[🛑 Capture Gate] BLOCKED — Knowledge capture overdue.",
		"",
		`${editedFiles} files edited over ${roundsPending} conversation rounds, but Capture phase NOT executed.`,
		"",
		"Methodology chain is MANDATORY: Read → Plan → Execute → **Capture**",
		"",
		"You MUST complete these actions IMMEDIATELY:",
		"1. Lessons learned (L-xxx) — update _meta/knowledge/lessons-learned.md (problem → diagnosis → fix → distillation)",
		"2. Known pitfalls (P-xxx) — update _meta/knowledge/pitfalls.md (symptom → root cause → fix) if applicable",
		"3. Architecture decisions (D-xxx) — update _meta/knowledge/decisions.md (context → options → rationale) if applicable",
		"4. Constraints (C-xxx) — update _meta/knowledge/constraints.md (constraint → level → source) if applicable",
		'5. If NO new knowledge: explicitly declare "Capture: No new knowledge to record"',
		"",
		"Example Capture output:",
		'  edit("_meta/knowledge/lessons-learned.md", append L-102 entry)',
		'  OR state: "Capture: No new knowledge to record"',
		"",
		"You MUST complete Capture before any further operations!",
	].join("\n")
}

// 认知审查门控 (Cognitive Review Gate)
export function cognitiveReviewBlock(
	conclusion: string, stage: string, risk: string, confidence: number,
	layer: string, dimensions: string[], reasons: string[],
): string {
	const layerLabel = LAYER_LABELS_EN[layer] ?? layer
	const reasonList = reasons.length > 0
		? reasons.map((r, i) => `${i + 1}. ${r}`).join("\n")
		: "1. Stage A evaluation requires additional cognitive evidence"
	return [
		"[🛑 Cognitive Review Gate] BLOCKED — Execute operation intercepted.",
		"",
		`Verdict: ${conclusion.toUpperCase()} (Stage ${stage}, risk=${risk}, confidence=${confidence.toFixed(2)})`,
		`Current layer: ${layerLabel}`,
		`Methodology dimensions covered: ${dimensions.join(", ") || "(none)"}`,
		"",
		"Trigger reasons:",
		reasonList,
		"",
		"You MUST address these deficiencies before executing any tools:",
		"1. Provide evidence binding — cite specific file paths and line numbers",
		"2. Establish causal chain — explain WHY the proposed change fixes the issue",
		"3. State verification plan — describe how you will confirm the fix works",
		"4. If philosophical dimension is missing — challenge your premises explicitly",
		"",
		"You MUST strictly follow these requirements!",
	].join("\n")
}

// 治理启动门控 (Governance Boot Gate)
export function governanceBootFailure(detail: string): string {
	return [
		"[🛑 Governance Boot Gate] BLOCKED — Startup governance check failed.",
		"",
		detail,
		"You MUST fix the Gaia runtime policy configuration before executing write operations.",
		"",
		"How to unblock: Ensure the Gaia governance server is running and policy is valid.",
	].join("\n")
}

const LAYER_LABELS_EN: Record<string, string> = {
	perception: "Perception Layer",
	understanding: "Understanding Layer",
	rationality: "Rationality Layer",
}

export const GATE_PROMPT = {
	batchClassificationBlock,
	preFlightReadBlock,
	writeSizeBlock,
	repeatFixConsecutiveFailuresBlock,
	repeatFixSameFileBlock,
	captureOverdueBlock,
	cognitiveReviewBlock,
	governanceBootFailure,
}
