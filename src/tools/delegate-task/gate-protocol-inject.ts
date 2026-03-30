const GATE_PROTOCOL_MARKER = "<gate-response-protocol>"
const GATE_PROTOCOL_END_MARKER = "</gate-response-protocol>"

const STATIC_GATE_PROTOCOL = `${GATE_PROTOCOL_MARKER}
[门控响应协议] 当你收到以 [🛑 开头的门控阻断消息时：

1. 立即停止当前操作路径
2. 按消息中的恢复指令执行（通常：读取文件取证 / 运行验证 / 执行 Capture）
3. 不要重试同一操作——门控会升级阻断级别
4. 如果门控持续触发 3 次以上，报告给主 Agent 并等待指示

门控是认知治理的一部分，违反门控 = 任务终止风险。
${GATE_PROTOCOL_END_MARKER}`

export function getGateProtocolInjection(): string {
	return STATIC_GATE_PROTOCOL
}

export function hasGateProtocolInjection(content: string): boolean {
	return content.includes(GATE_PROTOCOL_MARKER)
}
