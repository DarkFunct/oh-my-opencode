import type { SecretScanResult, SecretScanPattern } from "../session-evidence-collector/secret-scanner"

export interface SecretGateResult {
	shouldBlock: boolean
	severity: "critical" | "high" | "warning" | null
	message: string | null
	patterns: SecretScanPattern[]
}

export function evaluateSecretGate(scan: SecretScanResult): SecretGateResult {
	if (!scan.detected || scan.patterns.length === 0) {
		return { shouldBlock: false, severity: null, message: null, patterns: [] }
	}

	const layerAMatches = scan.patterns.filter((p) => p.layer === "A")
	const layerBNonTest = scan.patterns.filter((p) => p.layer === "B" && !p.isTestFile)
	const layerBTestOnly = scan.patterns.filter((p) => p.layer === "B" && p.isTestFile)

	if (layerAMatches.length > 0) {
		return {
			shouldBlock: true,
			severity: "critical",
			message: formatBlockMessage(layerAMatches),
			patterns: scan.patterns,
		}
	}

	if (layerBNonTest.length > 0) {
		return {
			shouldBlock: true,
			severity: "high",
			message: formatBlockMessage(layerBNonTest),
			patterns: scan.patterns,
		}
	}

	if (layerBTestOnly.length > 0) {
		return {
			shouldBlock: false,
			severity: "warning",
			message: formatWarningMessage(layerBTestOnly),
			patterns: scan.patterns,
		}
	}

	return { shouldBlock: false, severity: null, message: null, patterns: [] }
}

function formatBlockMessage(matches: SecretScanPattern[]): string {
	const types = [...new Set(matches.map((m) => m.type))].join(", ")
	const lines = matches.map((m) => `L${m.line}: ${m.redactedMatch} (${m.type})`).join("; ")
	return (
		`[🛑 SC-02 Secret Gate] 检测到敏感信息: ${types}\n` +
		`匹配详情: ${lines}\n` +
		`请使用环境变量或配置文件引用替代硬编码敏感信息。`
	)
}

function formatWarningMessage(matches: SecretScanPattern[]): string {
	const types = [...new Set(matches.map((m) => m.type))].join(", ")
	return (
		`[⚠️ SC-02 Secret Gate] 测试文件中检测到疑似敏感信息: ${types}\n` +
		`请确认为测试专用值。如为真实凭据，请使用环境变量替代。`
	)
}
