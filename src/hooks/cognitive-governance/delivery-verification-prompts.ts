import type { DeliveryEvidence, DocumentationEvidence } from "../cognitive-governance-shared/types"

export interface DirectiveBlock {
	content: string
	priority: "critical" | "high" | "medium" | "low"
}

export function buildDeliveryVerificationBlock(evidence: DeliveryEvidence): DirectiveBlock | null {
	if (evidence.codeChangesSinceBuild <= 0) return null

	const n = evidence.codeChangesSinceBuild
	const buildHint = evidence.lastBuildCommand
		? `\n构建命令: ${evidence.lastBuildCommand}`
		: ""

	const content = [
		`⚠️ 交付验证提醒`,
		`当前有 ${n} 个代码变更尚未构建。在通知用户部署/重启前：`,
		`□ 执行构建命令并确认成功${buildHint}`,
		`□ 确认构建产物路径指向最新版本`,
		`□ 确认所有测试在最新构建上通过`,
	].join("\n")

	return { content, priority: "high" }
}

export function buildDocumentationGovernanceBlock(
	evidence: DocumentationEvidence,
	threshold: number,
): DirectiveBlock | null {
	if (evidence.codeChangesWithoutDocUpdate < threshold) return null

	const n = evidence.codeChangesWithoutDocUpdate

	const content = [
		`📝 文档同步提醒`,
		`检测到 ${n} 个公共接口变更尚未同步文档。`,
		`请检查以下文档是否需要更新：`,
		`- docs/README.md（文件索引+配置参数）`,
		`- docs/architecture/cognitive-layers.md（Hook/规则矩阵）`,
		`- AGENTS.md（术语+映射表）`,
	].join("\n")

	return { content, priority: "medium" }
}
