import { InMemoryStore, KGSService } from "@gaia/kgs-middleware"
import type { KGSStore } from "@gaia/kgs-middleware"
import { log } from "../../shared"

let instance: KGSService | null = null
let storeInstance: KGSStore | null = null

export function getKGSStore(): KGSStore {
  if (!storeInstance) {
    storeInstance = new InMemoryStore()
    log("[kgs-service-provider] KGSStore initialized with InMemoryStore")
  }
  return storeInstance
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
  log("[kgs-service-provider] KGSService and KGSStore reset")
}
