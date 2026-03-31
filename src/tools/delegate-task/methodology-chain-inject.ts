import { INJECTION_PROMPT } from "../../config/gate-prompts"

const METHODOLOGY_CHAIN_MARKER = "<methodology-chain>"

export function getMethodologyChainInjection(): string {
	return INJECTION_PROMPT.methodologyChainInjection()
}

export function hasMethodologyChainInjection(content: string): boolean {
	return content.includes(METHODOLOGY_CHAIN_MARKER)
}
