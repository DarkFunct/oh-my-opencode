import { InMemoryStore, KGSService } from "@gaia/kgs-middleware"
import { log } from "../../shared"

let instance: KGSService | null = null

export function getKGSService(): KGSService {
  if (!instance) {
    const store = new InMemoryStore()
    instance = new KGSService(store)
    log("[kgs-service-provider] KGSService initialized with InMemoryStore")
  }
  return instance
}

export function resetKGSService(): void {
  instance = null
  log("[kgs-service-provider] KGSService reset")
}
