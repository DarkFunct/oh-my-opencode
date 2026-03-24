export function buildSourceAuthPrompt(
	filePath: string,
	operationType: string,
): string {
	return [
		"[SOURCE CODE PROTECTION — AUTHORIZATION REQUIRED]",
		"",
		"You are attempting to modify business source code:",
		`  Path: ${filePath}`,
		`  Operation: ${operationType}`,
		"",
		"This requires explicit user authorization. Use the `question` tool",
		"with EXACTLY the following parameters:",
		"",
		"  question: \"检测到源码修改操作，需要您授权后才能继续。\\n\\n\"",
		`    + \"目标文件: ${filePath}\\n\"`,
		`    + \"操作类型: ${operationType}\\n\\n\"`,
		"    + \"请选择授权范围：\"",
		"",
		"  options (use these EXACT labels, do NOT rephrase):",
		"    1. label: \"授权一次\"",
		"       description: \"仅授权本次操作，后续修改需重新授权\"",
		"    2. label: \"授权当前任务\"",
		"       description: \"授权到当前任务完成为止\"",
		"    3. label: \"授权当前会话\"",
		"       description: \"授权到当前会话结束为止\"",
		"    4. label: \"拒绝\"",
		"       description: \"拒绝本次操作\"",
		"",
		"  multiple: false",
		"  custom: false",
		"",
		"Wait for the user's response before taking ANY further action.",
		"Do NOT attempt alternative paths to modify the file.",
		"Do NOT use SSH, sed, or any indirect method to bypass this gate.",
	].join("\n")
}

export const REVOCATION_PATTERNS = [
	/撤销修改源码授权/,
	/撤销源码授权/,
]

export const REVOCATION_CONFIRMATION =
	"[SOURCE CODE AUTHORIZATION REVOKED]\n\n" +
	"All previously granted source code modification authorizations for " +
	"this session have been revoked by the user. Any subsequent source " +
	"code modification will require new authorization through the standard gate."

export const AUTH_LABEL_ONCE = "授权一次"
export const AUTH_LABEL_TASK = "授权当前任务"
export const AUTH_LABEL_SESSION = "授权当前会话"
export const AUTH_LABEL_DENY = "拒绝"
