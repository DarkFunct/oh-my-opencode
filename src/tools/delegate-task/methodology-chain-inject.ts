/**
 * Methodology Chain injection for sub-agent system prompts.
 *
 * Injects a minimal chain requirement block into every sub-agent system prompt,
 * ensuring chain requirements cannot be omitted regardless of Sisyphus behavior.
 *
 * Architecture goal: Input Gate — chain requirements are always present.
 */

const METHODOLOGY_CHAIN_MARKER = "<methodology-chain>"
const METHODOLOGY_CHAIN_END_MARKER = "</methodology-chain>"

/**
 * Static chain requirement injected into every sub-agent system prompt.
 * ~200 characters (~50 tokens), negligible token cost.
 */
const STATIC_CHAIN_REQUIREMENT = `${METHODOLOGY_CHAIN_MARKER}
[方法论链要求] 本任务必须遵循以下执行链条：

1. Read: 先阅读相关文档/代码，引用具体内容作为证据
2. Plan: 基于阅读提出方案，说明依据来源
3. Execute: 按方案执行，不偏离
4. Capture: 完成后声明知识沉淀结论（新发现/文档修正/无新发现）

输出中必须包含各环节的证据信号。缺失任何环节 = 任务未完成。
${METHODOLOGY_CHAIN_END_MARKER}`

export function getMethodologyChainInjection(): string {
  return STATIC_CHAIN_REQUIREMENT
}

export function hasMethodologyChainInjection(content: string): boolean {
  return content.includes(METHODOLOGY_CHAIN_MARKER)
}
