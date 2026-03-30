import { join } from "path"
import { mkdirSync } from "fs"

const GATE_METADATA_ROOT = ".sisyphus/gate-metadata"

export function getGateMetadataDir(sessionID: string): string {
	const dir = join(process.cwd(), GATE_METADATA_ROOT, sessionID)
	mkdirSync(dir, { recursive: true })
	return dir
}
