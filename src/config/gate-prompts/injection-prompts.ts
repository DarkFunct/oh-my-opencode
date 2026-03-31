// 注入型提示词 (Injection Prompts — Gate Protocol + Methodology Chain)
// 这些提示词注入到每个子 Agent 的 system prompt 中

// 门控响应协议注入 (Gate Response Protocol Injection)
export function gateProtocolInjection(): string {
	return [
		"<gate-response-protocol>",
		"[Gate Response Protocol] When you receive a gate block message starting with [🛑:",
		"",
		"1. STOP your current action path IMMEDIATELY",
		"2. READ the recovery instructions in the message carefully",
		"3. EXECUTE the required recovery action (typically: read files for evidence / run verification / execute Capture)",
		"4. DO NOT retry the same operation — gates escalate blocking severity on repeated violations",
		"5. If the gate triggers 3+ times consecutively, report to the parent Agent and wait for instructions",
		"",
		"Gates are part of cognitive governance. Violating gates = task termination risk.",
		"You MUST comply with gate requirements immediately and without exception.",
		"</gate-response-protocol>",
	].join("\n")
}

// 方法论链注入 (Methodology Chain Injection)
export function methodologyChainInjection(): string {
	return [
		"<methodology-chain>",
		"[Methodology Chain Requirement] This task MUST follow the execution chain below:",
		"",
		"1. Read: Read relevant docs/code FIRST, cite specific content as evidence",
		"2. Plan: Propose a plan based on reading, state your evidence sources",
		"3. Execute: Execute per plan, do not deviate",
		"4. Capture: After completion, declare knowledge capture conclusions (new findings / doc corrections / no new findings)",
		"",
		"Your output MUST contain evidence signals for each phase. Missing ANY phase = task incomplete.",
		"You MUST strictly follow this requirement!",
		"</methodology-chain>",
	].join("\n")
}

// 会话中止说明 (Session Abort Explanation)
export function sessionAbortExplanation(gateId: string, responseCount: number, blockCount: number, reason: string): string {
	return [
		"[🛑 Session Abort — Termination Notice]",
		"",
		`Gate ${gateId} was NOT resolved after ${responseCount} response attempts.`,
		`Total blocks: ${blockCount}`,
		`Termination reason: ${reason}`,
		"",
		"To continue this task, start a new session and complete the gate-required cognitive operations FIRST.",
	].join("\n")
}

// 方法论覆盖中止说明 (Methodology Coverage Abort)
export function methodologyCoverageAbort(
	totalResponses: number, complexity: string,
	required: number, actual: number,
	covered: string, missing: string,
): string {
	return [
		"[🛑 Methodology Coverage — Termination Notice]",
		"",
		`After ${totalResponses} response attempts, methodology coverage still does not meet requirements.`,
		`Task complexity: ${complexity}, Required: ${required} dimensions, Actual: ${actual} dimensions`,
		`Covered: ${covered}`,
		`Still missing: ${missing}`,
		"",
		"Session will terminate. To continue, start a new session and complete the missing cognitive dimensions FIRST.",
	].join("\n")
}

export const INJECTION_PROMPT = {
	gateProtocolInjection,
	methodologyChainInjection,
	sessionAbortExplanation,
	methodologyCoverageAbort,
}
