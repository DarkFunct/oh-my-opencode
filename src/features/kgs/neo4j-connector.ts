import {
  loadConfig,
  Neo4jConnectionManager,
  Neo4jTransactionFactory,
  Neo4jStore,
  Neo4jSchemaInitializer,
} from "@gaia/kgs-middleware"
import type { KGSStore } from "@gaia/kgs-middleware"
import { log } from "../../shared"

export async function connectNeo4j(): Promise<KGSStore | null> {
  try {
    const config = loadConfig()
    const connectionManager = new Neo4jConnectionManager(config.neo4j)
    await connectionManager.connect()

    const session = connectionManager.getSession()
    try {
      const initializer = new Neo4jSchemaInitializer()
      await initializer.initialize(session)
    } finally {
      await session.close()
    }

    const txFactory = new Neo4jTransactionFactory(
      () => connectionManager.getSession(),
    )
    const store = new Neo4jStore(txFactory)

    log("[neo4j-connector] Neo4j connected and schema initialized")
    return store
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    log("[neo4j-connector] Neo4j connection failed, running InMemory-only:", message)
    return null
  }
}
