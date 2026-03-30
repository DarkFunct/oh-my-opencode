import { afterEach, describe, expect, test } from "bun:test"
import { existsSync, rmSync } from "fs"
import { join } from "path"
import { getGateMetadataDir } from "./gate-metadata-path"

describe("gate-metadata-path", () => {
	const createdDirs: string[] = []

	afterEach(() => {
		for (const dir of createdDirs) {
			rmSync(dir, { recursive: true, force: true })
		}
		createdDirs.length = 0
	})

	test("returns path under .sisyphus/gate-metadata/{sessionID}", () => {
		const dir = getGateMetadataDir("ses_abc123")
		createdDirs.push(dir)

		expect(dir).toContain(".sisyphus/gate-metadata/ses_abc123")
	})

	test("creates directory if it does not exist", () => {
		const dir = getGateMetadataDir("ses_mkdir_test")
		createdDirs.push(dir)

		expect(existsSync(dir)).toBe(true)
	})

	test("uses process.cwd() as root", () => {
		const dir = getGateMetadataDir("ses_cwd_test")
		createdDirs.push(dir)

		const expected = join(process.cwd(), ".sisyphus/gate-metadata/ses_cwd_test")
		expect(dir).toBe(expected)
	})
})
