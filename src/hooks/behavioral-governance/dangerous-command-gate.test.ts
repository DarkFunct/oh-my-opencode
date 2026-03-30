import { describe, expect, test } from "bun:test"
import { evaluateDangerousCommand, type DangerousCommandConfig } from "./dangerous-command-gate"

describe("dangerous-command-gate", () => {
	describe("Layer A (hardcoded, always active)", () => {
		test("blocks rm -rf /", () => {
			const result = evaluateDangerousCommand("rm -rf /")
			expect(result.blocked).toBe(true)
			expect(result.category).toBe("destructive_file")
			expect(result.severity).toBe("critical")
			expect(result.layer).toBe("A")
		})

		test("blocks rm -rf ~", () => {
			const result = evaluateDangerousCommand("rm -rf ~")
			expect(result.blocked).toBe(true)
			expect(result.category).toBe("destructive_file")
		})

		test("blocks rm -rf $HOME", () => {
			const result = evaluateDangerousCommand("rm -rf $HOME")
			expect(result.blocked).toBe(true)
			expect(result.category).toBe("destructive_file")
		})

		test("blocks rm -rf ../", () => {
			const result = evaluateDangerousCommand("rm -rf ../")
			expect(result.blocked).toBe(true)
		})

		test("blocks git push --force", () => {
			const result = evaluateDangerousCommand("git push origin main --force")
			expect(result.blocked).toBe(true)
			expect(result.category).toBe("force_push")
			expect(result.severity).toBe("critical")
		})

		test("blocks git push -f", () => {
			const result = evaluateDangerousCommand("git push -f origin main")
			expect(result.blocked).toBe(true)
			expect(result.category).toBe("force_push")
		})

		test("does NOT block git push --force-with-lease", () => {
			const result = evaluateDangerousCommand("git push --force-with-lease origin main")
			expect(result.blocked).toBe(false)
		})

		test("blocks DROP TABLE", () => {
			const result = evaluateDangerousCommand("psql -c 'DROP TABLE users'")
			expect(result.blocked).toBe(true)
			expect(result.category).toBe("database_drop")
		})

		test("blocks DROP DATABASE", () => {
			const result = evaluateDangerousCommand("DROP DATABASE production")
			expect(result.blocked).toBe(true)
			expect(result.category).toBe("database_drop")
		})

		test("blocks mkfs on device", () => {
			const result = evaluateDangerousCommand("mkfs.ext4 /dev/sda1")
			expect(result.blocked).toBe(true)
			expect(result.category).toBe("disk_format")
			expect(result.severity).toBe("critical")
		})

		test("Layer A ignores enabled=false", () => {
			const config: DangerousCommandConfig = { enabled: false }
			const result = evaluateDangerousCommand("rm -rf /", config)
			expect(result.blocked).toBe(true)
			expect(result.layer).toBe("A")
		})

		test("Layer A ignores safe_rm_paths whitelist", () => {
			const config: DangerousCommandConfig = { safe_rm_paths: ["/"] }
			const result = evaluateDangerousCommand("rm -rf /", config)
			expect(result.blocked).toBe(true)
		})
	})

	describe("Layer B (configurable)", () => {
		test("blocks rm -rf on arbitrary path", () => {
			const result = evaluateDangerousCommand("rm -rf src/important/")
			expect(result.blocked).toBe(true)
			expect(result.category).toBe("destructive_file")
			expect(result.severity).toBe("high")
			expect(result.layer).toBe("B")
		})

		test("blocks git reset --hard", () => {
			const result = evaluateDangerousCommand("git reset --hard HEAD~3")
			expect(result.blocked).toBe(true)
			expect(result.category).toBe("hard_reset")
		})

		test("blocks TRUNCATE TABLE", () => {
			const result = evaluateDangerousCommand("TRUNCATE TABLE users")
			expect(result.blocked).toBe(true)
			expect(result.category).toBe("database_truncate")
		})

		test("blocks chmod 777 on root path", () => {
			const result = evaluateDangerousCommand("chmod 777 /var/www")
			expect(result.blocked).toBe(true)
			expect(result.category).toBe("permission_change")
		})

		test("blocks chmod -R 777 on root path", () => {
			const result = evaluateDangerousCommand("chmod -R 777 /etc")
			expect(result.blocked).toBe(true)
			expect(result.category).toBe("permission_change")
		})

		test("disabled via enabled=false", () => {
			const config: DangerousCommandConfig = { enabled: false }
			const result = evaluateDangerousCommand("rm -rf src/", config)
			expect(result.blocked).toBe(false)
		})

		test("disabled via default_patterns_enabled=false", () => {
			const config: DangerousCommandConfig = { enabled: true, default_patterns_enabled: false }
			const result = evaluateDangerousCommand("rm -rf src/", config)
			expect(result.blocked).toBe(false)
		})

		test("safe_rm_paths whitelist allows rm -rf dist/", () => {
			const result = evaluateDangerousCommand("rm -rf dist/")
			expect(result.blocked).toBe(false)
		})

		test("safe_rm_paths whitelist allows rm -rf node_modules/", () => {
			const result = evaluateDangerousCommand("rm -rf node_modules/")
			expect(result.blocked).toBe(false)
		})

		test("custom_patterns extend scanning", () => {
			const config: DangerousCommandConfig = {
				enabled: true,
				custom_patterns: [
					{ category: "container_kill", pattern: "docker\\s+rm\\s+-f", severity: "high" },
				],
			}
			const result = evaluateDangerousCommand("docker rm -f my-container", config)
			expect(result.blocked).toBe(true)
			expect(result.category).toBe("container_kill")
		})
	})

	describe("exclusion rules", () => {
		test("skips commands in comments", () => {
			const result = evaluateDangerousCommand("# rm -rf /")
			expect(result.blocked).toBe(false)
		})

		test("skips commands in echo strings", () => {
			const result = evaluateDangerousCommand('echo "rm -rf /"')
			expect(result.blocked).toBe(false)
		})
	})

	describe("clean commands", () => {
		test("allows normal git push", () => {
			const result = evaluateDangerousCommand("git push origin main")
			expect(result.blocked).toBe(false)
		})

		test("allows normal rm of specific file", () => {
			const result = evaluateDangerousCommand("rm temp.txt")
			expect(result.blocked).toBe(false)
		})

		test("allows SELECT query", () => {
			const result = evaluateDangerousCommand("psql -c 'SELECT * FROM users'")
			expect(result.blocked).toBe(false)
		})

		test("allows bun test", () => {
			const result = evaluateDangerousCommand("bun test src/foo.test.ts")
			expect(result.blocked).toBe(false)
		})
	})
})
