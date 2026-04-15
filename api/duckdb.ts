import { DuckDBInstance } from "@duckdb/node-api";
import { stat } from "node:fs/promises";
import { getActiveDuckDbPath, getManifestVersion } from "./duckdb-manifest";

let instance: DuckDBInstance | null = null;
let connection: Awaited<ReturnType<DuckDBInstance["connect"]>> | null = null;
let connectionInit: Promise<Awaited<ReturnType<DuckDBInstance["connect"]>>> | null = null;
let lastFileMtime: number | null = null;
let lastManifestVersion: number | null = null;
let currentDbPath: string | null = null;

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
    console.log(`[DuckDB] Manifest version changed: ${lastManifestVersion} -> ${currentVersion}`);
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

  try {
    const reader = await conn.runAndRead(
      "SELECT current_setting('access_mode') AS access_mode"
    );
    await reader.readAll();
    const rows = reader.getRowObjects();
    console.log(
      "[DuckDB] access_mode current_setting:",
      rows?.[0]?.access_mode ?? rows?.[0]
    );
  } catch (err) {
    try {
      const reader = await conn.runAndRead("PRAGMA show;");
      await reader.readAll();
      const rows = reader.getRowObjects();
      const accessRow = rows.find((r: any) => r.name === "access_mode");
      console.log("[DuckDB] PRAGMA show access_mode row:", accessRow);
    } catch (err2) {
      console.warn("[DuckDB] Failed to log access_mode", err, err2);
    }
  }

  return conn;
}

/**
 * Get a singleton DuckDB connection.
 * Automatically reconnects if the DuckDB file has been modified (e.g., by ETL).
 */
export async function getDuckDBConnection() {
  // Check if file changed and reconnect if needed
  if (connection && await hasFileChanged()) {
    console.log("[DuckDB] File changed, reconnecting...");
    await closeDuckDBConnection();
  }

  if (connection) return connection;

  if (!connectionInit) {
    connectionInit = openConnection()
      .then((conn) => {
        connection = conn;
        return conn;
      })
      .catch((err) => {
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
    connection.closeSync();
    connection = null;
    instance = null;
    connectionInit = null;
    lastFileMtime = null;
    lastManifestVersion = null;
    currentDbPath = null;
    console.log("[DuckDB] Connection closed");
  }
}
