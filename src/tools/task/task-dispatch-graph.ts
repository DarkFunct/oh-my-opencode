export interface TaskDispatchNode {
  id: string
  blockedBy: string[]
}

export interface TaskDispatchSummary {
  nodeCount: number
  edgeCount: number
  readyTaskIds: string[]
  cycleDetected: boolean
  cycleTaskIds: string[]
}

function buildBlockerMap(nodes: TaskDispatchNode[]): Map<string, string[]> {
  return new Map(nodes.map((node) => [node.id, node.blockedBy]))
}

function detectCycleTaskIds(blockerMap: Map<string, string[]>): string[] {
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const cycleTaskIds = new Set<string>()

  const dfs = (taskId: string): void => {
    if (visited.has(taskId)) return
    if (visiting.has(taskId)) {
      cycleTaskIds.add(taskId)
      return
    }

    visiting.add(taskId)
    const blockers = blockerMap.get(taskId) ?? []
    for (const blockerId of blockers) {
      if (!blockerMap.has(blockerId)) continue
      if (visiting.has(blockerId)) {
        cycleTaskIds.add(taskId)
        cycleTaskIds.add(blockerId)
        continue
      }
      dfs(blockerId)
      if (cycleTaskIds.has(blockerId)) {
        cycleTaskIds.add(taskId)
      }
    }
    visiting.delete(taskId)
    visited.add(taskId)
  }

  for (const taskId of blockerMap.keys()) {
    dfs(taskId)
  }

  return [...cycleTaskIds]
}

export function buildDispatchSummary(nodes: TaskDispatchNode[]): TaskDispatchSummary {
  const edgeCount = nodes.reduce((count, node) => count + node.blockedBy.length, 0)
  const readyTaskIds = nodes
    .filter((node) => node.blockedBy.length === 0)
    .map((node) => node.id)
  const cycleTaskIds = detectCycleTaskIds(buildBlockerMap(nodes))

  return {
    nodeCount: nodes.length,
    edgeCount,
    readyTaskIds,
    cycleDetected: cycleTaskIds.length > 0,
    cycleTaskIds,
  }
}
