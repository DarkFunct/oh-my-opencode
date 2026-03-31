import { INJECTION_PROMPT } from "../../config/gate-prompts"

const GATE_PROTOCOL_MARKER = "<gate-response-protocol>"

export function getGateProtocolInjection(): string {
	return INJECTION_PROMPT.gateProtocolInjection()
}

export function hasGateProtocolInjection(content: string): boolean {
	return content.includes(GATE_PROTOCOL_MARKER)
}
