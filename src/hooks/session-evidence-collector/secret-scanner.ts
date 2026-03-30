export interface SecretScanPattern {
	type: string
	line: number
	redactedMatch: string
	layer: "A" | "B"
	isTestFile: boolean
}

export interface SecretScanResult {
	detected: boolean
	patterns: SecretScanPattern[]
}

export interface SecretScanConfig {
	enabled?: boolean
	default_patterns_enabled?: boolean
	custom_patterns?: Array<{ type: string; pattern: string }>
	test_file_patterns?: string[]
	placeholder_values?: string[]
	env_file_patterns?: string[]
}

interface PatternDef {
	type: string
	regex: RegExp
}

const LAYER_A_PATTERNS: readonly PatternDef[] = [
	{ type: "private_key", regex: /-----BEGIN (?:RSA|EC|OPENSSH|DSA|PGP) PRIVATE KEY-----/ },
	{ type: "aws_key", regex: /AKIA[0-9A-Z]{16}/ },
	{ type: "aws_secret", regex: /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*[:=]\s*["'][A-Za-z0-9/+=]{40}["']/ },
	{ type: "connection_string", regex: /(?:mongodb\+srv|postgres|mysql|redis):\/\/[^:]+:[^@\s]+@/ },
	{ type: "github_token", regex: /gh[pousr]_[A-Za-z0-9_]{36,}/ },
] as const

const DEFAULT_LAYER_B_PATTERNS: readonly PatternDef[] = [
	{ type: "api_key", regex: /(?:api[_-]?key|apikey)\s*[:=]\s*["']([A-Za-z0-9_\-]{20,})["']/ },
	{ type: "password", regex: /(?:password|passwd|pwd)\s*[:=]\s*["']([^"']{8,})["']/ },
	{ type: "token", regex: /(?:token|secret)\s*[:=]\s*["']([A-Za-z0-9_\-]{20,})["']/ },
] as const

const DEFAULT_TEST_FILE_PATTERNS = ["**/test/**", "**/*.test.*", "**/mock/**", "**/fixture/**"]
const DEFAULT_PLACEHOLDER_VALUES = ["placeholder", "xxx", "your-key-here", "changeme", "todo"]
const DEFAULT_ENV_FILE_PATTERNS = ["**/.env", "**/.env.*"]

function matchesGlobSimple(filePath: string, patterns: string[]): boolean {
	const normalized = filePath.replace(/\\/g, "/")
	return patterns.some((pattern) => {
		const cleaned = pattern.replace(/^\*\*\//, "")
		if (cleaned.startsWith(".env")) {
			const fileName = normalized.split("/").pop() ?? normalized
			if (cleaned === ".env") return fileName === ".env"
			if (cleaned === ".env.*") return /^\.env\..+/.test(fileName)
		}
		if (cleaned.includes("*")) {
			const regexStr = cleaned.replace(/\./g, "\\.").replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*")
			return new RegExp(regexStr).test(normalized)
		}
		return normalized.includes(cleaned)
	})
}

function redact(match: string): string {
	const alphanumStart = match.match(/[A-Za-z0-9]/)
	if (!alphanumStart) return "****"
	const idx = match.indexOf(alphanumStart[0])
	const meaningful = match.slice(idx)
	if (meaningful.length <= 4) return meaningful + "****"
	return meaningful.slice(0, 4) + "*".repeat(Math.min(meaningful.length - 4, 16))
}

function containsPlaceholder(matchStr: string, placeholders: string[]): boolean {
	const lower = matchStr.toLowerCase()
	return placeholders.some((p) => lower.includes(p.toLowerCase()))
}

export function scanForSecrets(content: string, filePath: string, config?: SecretScanConfig): SecretScanResult {
	const results: SecretScanPattern[] = []
	const enabled = config?.enabled ?? true
	const defaultPatternsEnabled = config?.default_patterns_enabled ?? true
	const testPatterns = config?.test_file_patterns ?? DEFAULT_TEST_FILE_PATTERNS
	const placeholders = config?.placeholder_values ?? DEFAULT_PLACEHOLDER_VALUES
	const envPatterns = config?.env_file_patterns ?? DEFAULT_ENV_FILE_PATTERNS
	const isTestFile = matchesGlobSimple(filePath, testPatterns)
	const isEnvFile = matchesGlobSimple(filePath, envPatterns)

	const lines = content.split("\n")

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]
		for (const pat of LAYER_A_PATTERNS) {
			if (pat.regex.test(line)) {
				results.push({
					type: pat.type,
					line: i + 1,
					redactedMatch: redact(line.match(pat.regex)![0]),
					layer: "A",
					isTestFile,
				})
			}
		}
	}

	if (!enabled || isEnvFile) {
		return { detected: results.length > 0, patterns: results }
	}

	const layerBPatterns: PatternDef[] = defaultPatternsEnabled ? [...DEFAULT_LAYER_B_PATTERNS] : []

	if (config?.custom_patterns) {
		for (const cp of config.custom_patterns) {
			try {
				layerBPatterns.push({ type: cp.type, regex: new RegExp(cp.pattern) })
			} catch {
				// skip invalid regex from config
			}
		}
	}

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]
		for (const pat of layerBPatterns) {
			const match = line.match(pat.regex)
			if (match) {
				const capturedValue = match[1] ?? match[0]
				if (containsPlaceholder(capturedValue, placeholders)) continue
				results.push({
					type: pat.type,
					line: i + 1,
					redactedMatch: redact(match[0]),
					layer: "B",
					isTestFile,
				})
			}
		}
	}

	return { detected: results.length > 0, patterns: results }
}
