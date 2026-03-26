import { InMemoryStore, HybridStore, KGSService, loadStoreConfig } from "@gaia/kgs-middleware"
import type { KGSStore } from "@gaia/kgs-middleware"
import { connectNeo4j } from "./neo4j-connector"
import { log } from "../../shared"

let instance: KGSService | null = null
let storeInstance: KGSStore | null = null
let neo4jConnecting = false

export function getKGSStore(): KGSStore {
  if (storeInstance) return storeInstance

  const storeConfig = loadStoreConfig()
  const fallback = new InMemoryStore()
  const hybrid = new HybridStore(fallback)
  storeInstance = hybrid

  log("[kgs-service-provider] KGSStore initialized with HybridStore (InMemory fallback)")

  if (storeConfig.neo4jEnabled && !neo4jConnecting) {
    neo4jConnecting = true
    connectNeo4j()
      .then((neo4jStore) => {
        if (neo4jStore) {
          hybrid.setPrimary(neo4jStore)
          log("[kgs-service-provider] Neo4j primary store connected")
        }
      })
      .catch((error: unknown) => {
        const msg = error instanceof Error ? error.message : String(error)
        log("[kgs-service-provider] Neo4j background connect failed:", msg)
      })
      .finally(() => {
        neo4jConnecting = false
      })
  }

  return hybrid
}

export function getKGSService(): KGSService {
  if (!instance) {
    const store = getKGSStore()
    instance = new KGSService(store)
    log("[kgs-service-provider] KGSService initialized")
  }
  return instance
}

export function resetKGSService(): void {
  instance = null
  storeInstance = null
  neo4jConnecting = false
  log("[kgs-service-provider] KGSService and KGSStore reset")
}
