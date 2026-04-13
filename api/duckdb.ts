import { getActiveDuckDbPath, getManifestVersion } from "./duckdb-manifest";
import { duckDbGenerationManager } from "./db/generation-manager";
import { manifestResolver } from "./db/manifest-resolver";

export async function getDuckDBConnection() {
  const lease = await duckDbGenerationManager.acquireLease();
  return lease.run("legacy-get-connection", async (connection) => connection, { timeoutMs: 60_000 });
}

export async function closeDuckDBConnection() {
  await duckDbGenerationManager.shutdown();
}

export async function getDuckDbManagerStatus() {
  return duckDbGenerationManager.getStatus();
}

export function getDuckDbResolvedPath() {
  return manifestResolver.resolveSnapshot().dbPath;
}

export { getActiveDuckDbPath, getManifestVersion };
