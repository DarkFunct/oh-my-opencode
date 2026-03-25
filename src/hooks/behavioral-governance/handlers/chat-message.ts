import { resetSourceCodeAuth } from "../state"
import {
	REVOCATION_PATTERNS,
	REVOCATION_CONFIRMATION,
} from "../prompts/source-auth"
import { log } from "../../../shared"

function extractPromptText(
	parts: Array<{ type: string; text?: string }>,
): string {
	return parts
		.filter((p) => p.type === "text" && p.text)
		.map((p) => p.text)
		.join("\n")
}

function isRevocationMessage(text: string): boolean {
	return REVOCATION_PATTERNS.some((pattern) => pattern.test(text))
}

export function createChatMessageHandler() {
	return async (
		input: { sessionID: string },
		output: {
			message: Record<string, unknown>
			parts: Array<{ type: string; text?: string; [key: string]: unknown }>
		},
	): Promise<void> => {
		try {
			if (!output?.parts || !Array.isArray(output.parts)) return
			const promptText = extractPromptText(output.parts)
			if (!promptText) return

			if (isRevocationMessage(promptText)) {
				resetSourceCodeAuth(input.sessionID)

				const textPartIndex = output.parts.findIndex(
					(p) => p.type === "text" && p.text !== undefined,
				)
				if (textPartIndex !== -1) {
					const original = output.parts[textPartIndex].text ?? ""
					output.parts[textPartIndex].text =
						`${REVOCATION_CONFIRMATION}\n\n---\n\n${original}`
				}

				log("[behavioral-governance] Source code authorization revoked by user", {
					sessionID: input.sessionID,
				})
			}
		} catch (e) {
			log("[gaia-hook-safe] behavioralGovernance chatMessage failed", { error: e })
		}
	}
}
