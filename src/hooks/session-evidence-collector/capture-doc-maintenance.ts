import { access, readdir, readFile } from "node:fs/promises"
import path from "node:path"

const DEFAULT_DOCS_AUTO_MANAGEMENT_CONFIG: DocumentationAutoManagementConfig = {
	enabled: true,
	docsRoot: "docs",
	registryFile: "docs/README.md",
	maxReportItems: 8,
}

const KNOWLEDGE_CAPTURE_PATTERN = /_meta\/knowledge\/|lessons-learned|pitfalls|constraints|decisions/i

export interface DocumentationAutoManagementConfig {
	enabled: boolean
	docsRoot: string
	registryFile: string
	maxReportItems: number
}

interface CaptureDocMaintenanceArgs {
	projectRoot: string
	captureFilePath: string
	editedFiles: Iterable<string>
	config?: Partial<DocumentationAutoManagementConfig>
}

interface DocumentationInventoryReport {
	missingInRegistry: string[]
	staleRegistryEntries: string[]
	duplicateRegistryEntries: string[]
	hasDependencyGraph: boolean
	hasCatalogTable: boolean
	relatedCodeFiles: string[]
	registryUpdatedInSession: boolean
}

export async function evaluateCaptureDocumentationMaintenance(
	args: CaptureDocMaintenanceArgs,
): Promise<string | null> {
	const config: DocumentationAutoManagementConfig = {
		...DEFAULT_DOCS_AUTO_MANAGEMENT_CONFIG,
		...args.config,
	}

	if (!config.enabled || !isKnowledgeCaptureFile(args.captureFilePath)) {
		return null
	}

	const docsFiles = await collectDocsMarkdownFiles(args.projectRoot, config.docsRoot)
	if (docsFiles.length === 0) {
		return null
	}

	const registryFile = normalizeToPosix(config.registryFile)
	const report = await buildDocumentationReport({
		projectRoot: args.projectRoot,
		registryFile,
		docsFiles,
		editedFiles: Array.from(args.editedFiles),
		maxReportItems: config.maxReportItems,
	})

	return buildCaptureDocMaintenanceNotice(args.captureFilePath, report)
}

async function buildDocumentationReport(args: {
	projectRoot: string
	registryFile: string
	docsFiles: string[]
	editedFiles: string[]
	maxReportItems: number
}): Promise<DocumentationInventoryReport> {
	const registryAbsolute = path.join(args.projectRoot, args.registryFile)
	const registryContent = await tryReadText(registryAbsolute)
	const registryExtraction = extractRegistryDocPaths(registryContent)

	const docsSet = new Set(args.docsFiles)
	const missing = args.docsFiles
		.filter((filePath) => filePath !== args.registryFile)
		.filter((filePath) => !registryExtraction.paths.has(filePath))
		.slice(0, args.maxReportItems)

	const stale = Array.from(registryExtraction.paths)
		.filter((filePath) => filePath.startsWith("docs/"))
		.filter((filePath) => filePath !== args.registryFile)
		.filter((filePath) => !docsSet.has(filePath))
		.slice(0, args.maxReportItems)

	const duplicateEntries = Array.from(registryExtraction.duplicates)
		.slice(0, args.maxReportItems)

	const relatedCodeFiles = args.editedFiles
		.filter((filePath) => filePath !== "__apply_patch__")
		.map(normalizeToPosix)
		.filter((filePath) => !filePath.startsWith("docs/"))
		.filter((filePath) => !isKnowledgeCaptureFile(filePath))
		.slice(0, args.maxReportItems)

	const registryUpdatedInSession = args.editedFiles
		.map(normalizeToPosix)
		.some((filePath) => filePath === args.registryFile)

	return {
		missingInRegistry: missing,
		staleRegistryEntries: stale,
		duplicateRegistryEntries: duplicateEntries,
		hasDependencyGraph: /```mermaid|依存关系图|dependency graph/i.test(registryContent),
		hasCatalogTable: /\|\s*(文件|File).*(作用|Purpose).*(版本|Version)\s*\|/i.test(registryContent),
		relatedCodeFiles,
		registryUpdatedInSession,
	}
}

function buildCaptureDocMaintenanceNotice(
	captureFilePath: string,
	report: DocumentationInventoryReport,
): string | null {
	const hasInventoryGap =
		report.missingInRegistry.length > 0 ||
		report.staleRegistryEntries.length > 0 ||
		report.duplicateRegistryEntries.length > 0
	const hasRegistryStructureGap = !report.hasDependencyGraph || !report.hasCatalogTable
	const hasCorrelationGap = report.relatedCodeFiles.length > 0 && !report.registryUpdatedInSession

	if (!hasInventoryGap && !hasRegistryStructureGap && !hasCorrelationGap) {
		return null
	}

	const lines = [
		"\n\n[📚 Capture 文档自动管理检查]",
		`检测到 Capture 写入: ${captureFilePath}`,
		"docs/ 是唯一项目文档目录，已触发文档一致性监控。",
		"",
		"知识沉淀建议维度（附示例）：",
		"1. 经验教训：问题→诊断→修复→提炼（示例：L-xxx）",
		"2. 陷阱：症状→根因→修复（示例：P-xxx）",
		"3. 决策：背景→取舍→结论→影响（示例：D-xxx）",
		"4. 约束：边界条件/不可变规则（示例：C-xxx）",
		"5. 验证证据：测试/构建/LSP 结果与命令日志",
		"",
		"文档治理动作：主动识别 → 比对 → 合并 → 清理",
	]

	if (report.relatedCodeFiles.length > 0) {
		lines.push(`- 关联变更文件: ${report.relatedCodeFiles.join(", ")}`)
	}
	if (report.missingInRegistry.length > 0) {
		lines.push(`- [识别] docs 新增文件未入清单: ${report.missingInRegistry.join(", ")}`)
	}
	if (report.staleRegistryEntries.length > 0) {
		lines.push(`- [清理] README 中存在失效条目（文件已不存在）: ${report.staleRegistryEntries.join(", ")}`)
	}
	if (report.duplicateRegistryEntries.length > 0) {
		lines.push(`- [合并] README 中存在重复条目: ${report.duplicateRegistryEntries.join(", ")}`)
	}
	if (!report.hasDependencyGraph) {
		lines.push("- [比对] docs/README.md 缺少依存关系图（建议 mermaid）")
	}
	if (!report.hasCatalogTable) {
		lines.push("- [比对] docs/README.md 缺少文档清单表（文件路径/作用/版本）")
	}
	if (!report.registryUpdatedInSession) {
		lines.push("- [同步] 本轮未更新 docs/README.md，请补充关联关系与版本说明")
	}

	return lines.join("\n")
}

async function collectDocsMarkdownFiles(projectRoot: string, docsRoot: string): Promise<string[]> {
	const docsAbsolute = path.join(projectRoot, docsRoot)
	const exists = await pathExists(docsAbsolute)
	if (!exists) return []

	const results: string[] = []
	const stack: string[] = [docsAbsolute]
	while (stack.length > 0) {
		const current = stack.pop()
		if (!current) break
		const entries = await readdir(current, { withFileTypes: true })
		for (const entry of entries) {
			const absolute = path.join(current, entry.name)
			if (entry.isDirectory()) {
				stack.push(absolute)
				continue
			}
			if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".md")) continue
			results.push(normalizeToPosix(path.relative(projectRoot, absolute)))
		}
	}

	return results.sort((a, b) => a.localeCompare(b))
}

function extractRegistryDocPaths(content: string): { paths: Set<string>; duplicates: Set<string> } {
	const paths = new Set<string>()
	const counts = new Map<string, number>()
	const regexList = [
		/`([^`\n]+\.md)`/g,
		/\[[^\]]+\]\(([^)\n]+\.md(?:#[^)]+)?)\)/g,
	]

	for (const regex of regexList) {
		let match = regex.exec(content)
		while (match) {
			const normalized = normalizeDocumentationPath(match[1])
			if (normalized && normalized.startsWith("docs/")) {
				paths.add(normalized)
				counts.set(normalized, (counts.get(normalized) ?? 0) + 1)
			}
			match = regex.exec(content)
		}
	}

	const duplicates = new Set(
		Array.from(counts.entries())
			.filter(([, count]) => count > 1)
			.map(([filePath]) => filePath),
	)

	return { paths, duplicates }
}

function normalizeDocumentationPath(rawPath: string): string | null {
	const withoutAnchor = rawPath.split("#")[0]
	const normalized = normalizeToPosix(withoutAnchor).replace(/^\.\//, "")
	if (!normalized) return null
	if (normalized.startsWith("docs/")) return normalized
	if (!normalized.includes("/")) return `docs/${normalized}`
	return `docs/${normalized}`
}

function isKnowledgeCaptureFile(filePath: string): boolean {
	return KNOWLEDGE_CAPTURE_PATTERN.test(filePath)
}

function normalizeToPosix(filePath: string): string {
	return filePath.replace(/\\/g, "/")
}

async function pathExists(filePath: string): Promise<boolean> {
	try {
		await access(filePath)
		return true
	} catch {
		return false
	}
}

async function tryReadText(filePath: string): Promise<string> {
	try {
		return await readFile(filePath, "utf8")
	} catch {
		return ""
	}
}
