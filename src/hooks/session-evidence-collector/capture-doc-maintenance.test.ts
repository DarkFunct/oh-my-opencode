/// <reference types="bun-types/test-globals" />
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { evaluateCaptureDocumentationMaintenance } from "./capture-doc-maintenance"
const KNOWLEDGE_CAPTURE_FILE = "_meta/knowledge/lessons-learned.md"

function writeProjectFile(projectRoot: string, relativePath: string, content: string): void {
	const absolutePath = join(projectRoot, relativePath)
	mkdirSync(dirname(absolutePath), { recursive: true })
	writeFileSync(absolutePath, content, "utf8")
}

function buildRegistry(args: {
	entries: string[]
	includeDependencyGraph?: boolean
	includeCatalogTable?: boolean
}): string {
	const includeDependencyGraph = args.includeDependencyGraph ?? true
	const includeCatalogTable = args.includeCatalogTable ?? true

	const lines = ["# docs 索引", ""]

	if (includeDependencyGraph) {
		lines.push("```mermaid", "graph TD", "README --> Docs", "```", "")
	}

	if (includeCatalogTable) {
		lines.push("| 文件 | 作用 | 版本 |", "| --- | --- | --- |")
	}

	for (const entry of args.entries) {
		if (includeCatalogTable) {
			lines.push(`| \`${entry}\` | 说明 | v1 |`)
			continue
		}
		lines.push(`- \`${entry}\``)
	}

	return lines.join("\n")
}

async function withTempProject(run: (projectRoot: string) => Promise<void>): Promise<void> {
	const projectRoot = mkdtempSync(join(tmpdir(), "capture-doc-maintenance-"))
	try {
		await run(projectRoot)
	} finally {
		rmSync(projectRoot, { recursive: true, force: true })
	}
}

describe("capture-doc-maintenance", () => {
	test("returns null when disabled", async () => {
		await withTempProject(async (projectRoot) => {
			const notice = await evaluateCaptureDocumentationMaintenance({
				projectRoot,
				captureFilePath: KNOWLEDGE_CAPTURE_FILE,
				editedFiles: [KNOWLEDGE_CAPTURE_FILE],
				config: { enabled: false },
			})
			expect(notice).toBeNull()
		})
	})

	test("returns null when capture file is not a knowledge file", async () => {
		await withTempProject(async (projectRoot) => {
			const notice = await evaluateCaptureDocumentationMaintenance({
				projectRoot,
				captureFilePath: "src/foo.ts",
				editedFiles: ["src/foo.ts"],
			})
			expect(notice).toBeNull()
		})
	})

	test("returns null when docs directory does not exist", async () => {
		await withTempProject(async (projectRoot) => {
			const notice = await evaluateCaptureDocumentationMaintenance({
				projectRoot,
				captureFilePath: KNOWLEDGE_CAPTURE_FILE,
				editedFiles: [KNOWLEDGE_CAPTURE_FILE],
			})
			expect(notice).toBeNull()
		})
	})

	test("returns null when docs inventory is clean", async () => {
		await withTempProject(async (projectRoot) => {
			writeProjectFile(projectRoot, "docs/guide.md", "# guide")
			writeProjectFile(
				projectRoot,
				"docs/README.md",
				buildRegistry({ entries: ["docs/README.md", "docs/guide.md"] }),
			)

			const notice = await evaluateCaptureDocumentationMaintenance({
				projectRoot,
				captureFilePath: KNOWLEDGE_CAPTURE_FILE,
				editedFiles: [KNOWLEDGE_CAPTURE_FILE],
			})

			expect(notice).toBeNull()
		})
	})

	test("reports docs files missing from README registry", async () => {
		await withTempProject(async (projectRoot) => {
			writeProjectFile(projectRoot, "docs/guide.md", "# guide")
			writeProjectFile(projectRoot, "docs/new-file.md", "# new")
			writeProjectFile(
				projectRoot,
				"docs/README.md",
				buildRegistry({ entries: ["docs/README.md", "docs/guide.md"] }),
			)

			const notice = await evaluateCaptureDocumentationMaintenance({
				projectRoot,
				captureFilePath: KNOWLEDGE_CAPTURE_FILE,
				editedFiles: [KNOWLEDGE_CAPTURE_FILE],
			})

			expect(notice).not.toBeNull()
			expect(notice).toContain("docs 新增文件未入清单")
			expect(notice).toContain("docs/new-file.md")
		})
	})

	test("reports stale README registry entries", async () => {
		await withTempProject(async (projectRoot) => {
			writeProjectFile(projectRoot, "docs/guide.md", "# guide")
			writeProjectFile(
				projectRoot,
				"docs/README.md",
				buildRegistry({ entries: ["docs/README.md", "docs/guide.md", "docs/ghost.md"] }),
			)

			const notice = await evaluateCaptureDocumentationMaintenance({
				projectRoot,
				captureFilePath: KNOWLEDGE_CAPTURE_FILE,
				editedFiles: [KNOWLEDGE_CAPTURE_FILE],
			})

			expect(notice).not.toBeNull()
			expect(notice).toContain("失效条目")
			expect(notice).toContain("已不存在")
			expect(notice).toContain("docs/ghost.md")
		})
	})

	test("reports missing dependency graph in docs/README.md", async () => {
		await withTempProject(async (projectRoot) => {
			writeProjectFile(projectRoot, "docs/guide.md", "# guide")
			writeProjectFile(
				projectRoot,
				"docs/README.md",
				buildRegistry({
					entries: ["docs/README.md", "docs/guide.md"],
					includeDependencyGraph: false,
				}),
			)

			const notice = await evaluateCaptureDocumentationMaintenance({
				projectRoot,
				captureFilePath: KNOWLEDGE_CAPTURE_FILE,
				editedFiles: [KNOWLEDGE_CAPTURE_FILE],
			})

			expect(notice).not.toBeNull()
			expect(notice).toContain("缺少依存关系图")
		})
	})

	test("respects maxReportItems truncation", async () => {
		await withTempProject(async (projectRoot) => {
			for (const fileName of ["a.md", "b.md", "c.md", "d.md"]) {
				writeProjectFile(projectRoot, `docs/${fileName}`, `# ${fileName}`)
			}
			writeProjectFile(
				projectRoot,
				"docs/README.md",
				buildRegistry({ entries: ["docs/README.md"] }),
			)

			const notice = await evaluateCaptureDocumentationMaintenance({
				projectRoot,
				captureFilePath: KNOWLEDGE_CAPTURE_FILE,
				editedFiles: [KNOWLEDGE_CAPTURE_FILE],
				config: { maxReportItems: 2 },
			})

			expect(notice).not.toBeNull()
			expect(notice).toContain("docs/a.md")
			expect(notice).toContain("docs/b.md")
			expect(notice).not.toContain("docs/c.md")
			expect(notice).not.toContain("docs/d.md")
		})
	})
})
