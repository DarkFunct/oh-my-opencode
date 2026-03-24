export interface ChainSignalResult {
  readDetected: boolean
  planDetected: boolean
  captureDetected: boolean
  missingSignals: string[]
}

const READ_PATTERNS = [
  /(?:阅读|读取|查看|参考|引用|根据|基于).{0,20}(?:文档|\.md|constraints|pitfalls|decisions|lessons)/i,
  /(?:Read|Reading|Reviewed|Referenced|According to).{0,30}(?:doc|\.md|file|section)/i,
  /(?:_meta\/|\.opencode\/|AGENTS\.md)/,
]

const PLAN_PATTERNS = [
  /(?:方案|计划|策略|思路|设计|建议|推荐)[:：]/,
  /(?:Plan|Approach|Strategy|Proposal|Design)[:：\s]/i,
  /(?:我[的将]|建议|推荐|采用|选择).{0,20}(?:方案|方法|策略|做法)/,
]

const CAPTURE_PATTERNS = [
  /(?:知识沉淀|经验总结|新发现|无新发现|文档修正|文档偏差|取证修正|lessons?.?learned|沉淀声明)/i,
  /(?:Capture|沉淀|记录|归档)[:：].{0,50}(?:pitfall|lesson|decision|文档|偏差|修正|无|没有|none)/i,
  /(?:新增|添加|更新|补充|修正).{0,20}(?:pitfalls?|lessons?|decisions?|经验|教训|陷阱|文档|源文档)/i,
]

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some(p => p.test(text))
}

export function detectChainSignals(output: string): ChainSignalResult {
  const missing: string[] = []

  const readDetected = matchesAny(output, READ_PATTERNS)
  const planDetected = matchesAny(output, PLAN_PATTERNS)
  const captureDetected = matchesAny(output, CAPTURE_PATTERNS)

  if (!readDetected) missing.push("Read（文档引用）")
  if (!planDetected) missing.push("Plan（方案陈述）")
  if (!captureDetected) missing.push("Capture（知识沉淀声明）")

  return { readDetected, planDetected, captureDetected, missingSignals: missing }
}
