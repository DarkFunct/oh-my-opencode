import { describe, expect, test } from "bun:test"
import { scanForSecrets, type SecretScanConfig } from "./secret-scanner"

describe("secret-scanner", () => {
	describe("Layer A (hardcoded, always active)", () => {
		test("detects RSA private key", () => {
			const content = `const key = "-----BEGIN RSA PRIVATE KEY-----\nMIIE..."`
			const result = scanForSecrets(content, "src/config.ts")
			expect(result.detected).toBe(true)
			expect(result.patterns[0].type).toBe("private_key")
			expect(result.patterns[0].layer).toBe("A")
		})

		test("detects EC private key", () => {
			const content = `-----BEGIN EC PRIVATE KEY-----`
			const result = scanForSecrets(content, "src/main.ts")
			expect(result.detected).toBe(true)
			expect(result.patterns[0].type).toBe("private_key")
		})

		test("detects AWS Access Key ID", () => {
			const content = `const accessKey = "AKIAIOSFODNN7EXAMPLE"`
			const result = scanForSecrets(content, "src/aws.ts")
			expect(result.detected).toBe(true)
			expect(result.patterns[0].type).toBe("aws_key")
			expect(result.patterns[0].layer).toBe("A")
		})

		test("detects AWS Secret Key", () => {
			const content = `aws_secret_access_key = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"`
			const result = scanForSecrets(content, "src/config.ts")
			expect(result.detected).toBe(true)
			expect(result.patterns[0].type).toBe("aws_secret")
		})

		test("detects connection string with credentials", () => {
			const content = `const db = "postgres://admin:s3cret@db.example.com:5432/mydb"`
			const result = scanForSecrets(content, "src/db.ts")
			expect(result.detected).toBe(true)
			expect(result.patterns[0].type).toBe("connection_string")
		})

		test("detects mongodb+srv connection string", () => {
			const content = `mongodb+srv://user:pass123@cluster.mongodb.net/db`
			const result = scanForSecrets(content, "src/mongo.ts")
			expect(result.detected).toBe(true)
			expect(result.patterns[0].type).toBe("connection_string")
		})

		test("detects GitHub token", () => {
			const content = `const token = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij"`
			const result = scanForSecrets(content, "src/github.ts")
			expect(result.detected).toBe(true)
			expect(result.patterns[0].type).toBe("github_token")
			expect(result.patterns[0].layer).toBe("A")
		})

		test("Layer A ignores enabled=false", () => {
			const content = `-----BEGIN RSA PRIVATE KEY-----`
			const config: SecretScanConfig = { enabled: false }
			const result = scanForSecrets(content, "src/main.ts", config)
			expect(result.detected).toBe(true)
			expect(result.patterns[0].layer).toBe("A")
		})

		test("Layer A NOT exempt for test files (private key)", () => {
			const content = `-----BEGIN RSA PRIVATE KEY-----`
			const result = scanForSecrets(content, "src/test/fixtures/key.ts")
			expect(result.detected).toBe(true)
			expect(result.patterns[0].layer).toBe("A")
			expect(result.patterns[0].isTestFile).toBe(true)
		})
	})

	describe("Layer B (configurable)", () => {
		test("detects api_key assignment", () => {
			const content = `const api_key = "sk-1234567890abcdefghij"`
			const result = scanForSecrets(content, "src/client.ts")
			expect(result.detected).toBe(true)
			expect(result.patterns[0].type).toBe("api_key")
			expect(result.patterns[0].layer).toBe("B")
		})

		test("detects password assignment", () => {
			const content = `password = "MyS3cretP@ssword!"`
			const result = scanForSecrets(content, "src/auth.ts")
			expect(result.detected).toBe(true)
			expect(result.patterns[0].type).toBe("password")
		})

		test("detects token assignment", () => {
			const content = `token = "eyJhbGciOiJIUzI1NiIsIn"`
			const result = scanForSecrets(content, "src/auth.ts")
			expect(result.detected).toBe(true)
			expect(result.patterns[0].type).toBe("token")
		})

		test("disabled via enabled=false", () => {
			const content = `api_key = "sk-1234567890abcdefghij"`
			const config: SecretScanConfig = { enabled: false }
			const result = scanForSecrets(content, "src/client.ts", config)
			// Layer B should be skipped, only Layer A scans
			const layerBMatches = result.patterns.filter((p) => p.layer === "B")
			expect(layerBMatches).toHaveLength(0)
		})

		test("disabled via default_patterns_enabled=false", () => {
			const content = `api_key = "sk-1234567890abcdefghij"`
			const config: SecretScanConfig = { enabled: true, default_patterns_enabled: false }
			const result = scanForSecrets(content, "src/client.ts", config)
			const layerBMatches = result.patterns.filter((p) => p.layer === "B")
			expect(layerBMatches).toHaveLength(0)
		})

		test("test file match is flagged as isTestFile", () => {
			const content = `api_key = "sk-1234567890abcdefghij"`
			const result = scanForSecrets(content, "src/test/client.test.ts")
			expect(result.detected).toBe(true)
			expect(result.patterns[0].isTestFile).toBe(true)
		})

		test("custom_patterns extend scanning", () => {
			const content = `PAYMENT_KEY = "xk_test_FAKE000000000000000000000"`
			const config: SecretScanConfig = {
				enabled: true,
				custom_patterns: [{ type: "payment_key", pattern: "xk_test_[A-Za-z0-9]{24,}" }],
			}
			const result = scanForSecrets(content, "src/billing.ts", config)
			expect(result.detected).toBe(true)
			expect(result.patterns[0].type).toBe("payment_key")
			expect(result.patterns[0].layer).toBe("B")
		})
	})

	describe("exclusion rules", () => {
		test("skips placeholder values", () => {
			const content = `api_key = "placeholder"`
			const result = scanForSecrets(content, "src/config.ts")
			const layerBMatches = result.patterns.filter((p) => p.layer === "B")
			expect(layerBMatches).toHaveLength(0)
		})

		test("skips 'your-key-here' placeholder", () => {
			const content = `token = "your-key-here-placeholder-value"`
			const result = scanForSecrets(content, "src/config.ts")
			const layerBMatches = result.patterns.filter((p) => p.layer === "B")
			expect(layerBMatches).toHaveLength(0)
		})

		test("skips env files", () => {
			const content = `API_KEY = "sk-1234567890abcdefghij"`
			const result = scanForSecrets(content, ".env")
			const layerBMatches = result.patterns.filter((p) => p.layer === "B")
			expect(layerBMatches).toHaveLength(0)
		})

		test("skips .env.local", () => {
			const content = `password = "realpassword123!"`
			const result = scanForSecrets(content, ".env.local")
			const layerBMatches = result.patterns.filter((p) => p.layer === "B")
			expect(layerBMatches).toHaveLength(0)
		})

		test("Layer A placeholder skip for private key (skip only explicit placeholder content)", () => {
			// Real private key content should NOT be skipped even with placeholder-like values nearby
			const content = `-----BEGIN RSA PRIVATE KEY-----`
			const result = scanForSecrets(content, "src/config.ts")
			expect(result.detected).toBe(true)
			expect(result.patterns[0].layer).toBe("A")
		})
	})

	describe("redaction", () => {
		test("redactedMatch shows first 4 chars + mask", () => {
			const content = `const key = "AKIAIOSFODNN7EXAMPLE"`
			const result = scanForSecrets(content, "src/aws.ts")
			expect(result.patterns[0].redactedMatch).toMatch(/^AKIA\*+$/)
		})
	})

	describe("multiple detections", () => {
		test("detects multiple secrets in same content", () => {
			const content = [
				`const awsKey = "AKIAIOSFODNN7EXAMPLE"`,
				`password = "MySuperSecret123!"`,
				`const db = "postgres://admin:pass@host/db"`,
			].join("\n")
			const result = scanForSecrets(content, "src/config.ts")
			expect(result.detected).toBe(true)
			expect(result.patterns.length).toBeGreaterThanOrEqual(3)
		})
	})

	describe("clean content", () => {
		test("no detection in normal code", () => {
			const content = `export function add(a: number, b: number): number { return a + b }`
			const result = scanForSecrets(content, "src/math.ts")
			expect(result.detected).toBe(false)
			expect(result.patterns).toHaveLength(0)
		})

		test("no detection for short values", () => {
			const content = `api_key = "short"`
			const result = scanForSecrets(content, "src/config.ts")
			expect(result.detected).toBe(false)
		})
	})
})
