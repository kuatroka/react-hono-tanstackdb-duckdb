import { DuckDBInstance } from "@duckdb/node-api";
import { stat } from "node:fs/promises";
import { getActiveDuckDbPath, getManifestVersion } from "./duckdb-manifest";

let instance: DuckDBInstance | null = null;
let connection: Awaited<ReturnType<DuckDBInstance["connect"]>> | null = null;
let connectionInit: Promise<Awaited<ReturnType<DuckDBInstance["connect"]>>> | null = null;
let lastFileMtime: number | null = null;
let lastManifestVersion: number | null = null;
let currentDbPath: string | null = null;
let isReconnecting = false;

/**
 * Get the file's modification time in milliseconds
 */
async function getFileMtime(dbPath: string): Promise<number | null> {
  try {
    const stats = await stat(dbPath);
    return stats.mtimeMs;
  } catch {
    return null;
  }
}

/**
 * Check if the DuckDB file has changed (manifest version or file mtime)
 */
async function hasFileChanged(): Promise<boolean> {
  // Check manifest version first (blue-green pattern)
  const currentVersion = getManifestVersion();
  if (currentVersion !== null && lastManifestVersion !== null && currentVersion !== lastManifestVersion) {
    return true;
  }

  // Fallback: check file mtime
  if (lastFileMtime === null || currentDbPath === null) return false;
  const currentMtime = await getFileMtime(currentDbPath);
  return currentMtime !== null && currentMtime !== lastFileMtime;
}

/**
 * Open a new DuckDB connection and track file mtime
 * Uses DuckDBInstance.create() instead of fromCache() to ensure fresh data after file changes.
 */
async function openConnection(): Promise<Awaited<ReturnType<DuckDBInstance["connect"]>>> {
  // Get the active database path from manifest (or fallback to env var)
  currentDbPath = getActiveDuckDbPath();

  // Track manifest version and file mtime
  lastManifestVersion = getManifestVersion();
  lastFileMtime = await getFileMtime(currentDbPath);

  // Use create() instead of fromCache() to avoid stale cached instances
  // This ensures we always read fresh data when the file has changed
  instance = await DuckDBInstance.create(currentDbPath, {
    threads: "4",
    access_mode: "READ_ONLY",
  });
  const conn = await instance.connect();
  console.log(`[DuckDB] Connected to ${currentDbPath} (version: ${lastManifestVersion}, mtime: ${lastFileMtime})`);

  return conn;
}

/**
 * Get a singleton DuckDB connection.
 * Automatically reconnects if the DuckDB file has been modified (e.g., by ETL).
 */
export async function getDuckDBConnection() {
  if (isReconnecting) {
    if (connectionInit) return connectionInit;
  }

  // Check if file changed and reconnect if needed
  if (connection && !isReconnecting && await hasFileChanged()) {
    console.log("[DuckDB] File changed, reconnecting...");
    isReconnecting = true;
    
    // We don't close the old connection immediately because queries might be in flight.
    // We just create a new one and replace the singleton.
    connectionInit = openConnection()
      .then((conn) => {
        const oldConnection = connection;
        connection = conn;
        isReconnecting = false;
        
        // Try to close the old connection safely in the background after a delay
        // to let in-flight queries finish.
        if (oldConnection) {
          setTimeout(() => {
            try {
              oldConnection.closeSync();
              console.log("[DuckDB] Old connection closed successfully");
            } catch (e) {
              console.warn("[DuckDB] Failed to close old connection safely", e);
            }
          }, 10000); // 10 seconds grace period
        }
        
        return conn;
      })
      .catch((err) => {
        isReconnecting = false;
        connectionInit = null;
        throw err;
      });
      
    return connectionInit;
  }

  if (connection) return connection;

  if (!connectionInit) {
    isReconnecting = true;
    connectionInit = openConnection()
      .then((conn) => {
        connection = conn;
        isReconnecting = false;
        return conn;
      })
      .catch((err) => {
        isReconnecting = false;
        connectionInit = null;
        throw err;
      });
  }

  return connectionInit;
}

/**
 * Close the DuckDB connection (for graceful shutdown).
 */
export async function closeDuckDBConnection() {
  if (connection) {
    try {
      connection.closeSync();
    } catch(e) {}
    connection = null;
    instance = null;
    connectionInit = null;
    lastFileMtime = null;
    lastManifestVersion = null;
    currentDbPath = null;
    console.log("[DuckDB] Connection closed");
  }
}
