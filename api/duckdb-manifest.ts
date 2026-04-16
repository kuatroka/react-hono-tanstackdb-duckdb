import { readFileSync, existsSync, statSync } from "node:fs";
import { dirname, join, basename } from "node:path";

const DUCKDB_PATH = process.env.DUCKDB_PATH || "/Users/yo_macbook/Documents/app_data/TR_05_DB/TR_05_DUCKDB_FILE.duckdb";

export interface DbManifest {
  active: "a" | "b";
  version: number;
  lastUpdated: string;
}

function getManifestPath(): string {
  return join(dirname(DUCKDB_PATH), "db_manifest.json");
}

export function readManifest(): DbManifest | null {
  const manifestPath = getManifestPath();

  if (!existsSync(manifestPath)) {
    return null;
  }

  try {
    const content = readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(content) as DbManifest;

    if (!manifest.active || !["a", "b"].includes(manifest.active)) {
      console.warn("[DuckDB Manifest] Invalid active value:", manifest.active);
      return null;
    }

    return manifest;
  } catch (err) {
    console.warn("[DuckDB Manifest] Failed to read manifest:", err);
    return null;
  }
}

function resolveFallbackDuckDbPath(): string {
  if (existsSync(DUCKDB_PATH)) {
    return DUCKDB_PATH;
  }

  const dir = dirname(DUCKDB_PATH);
  const base = basename(DUCKDB_PATH, ".duckdb");
  const candidates = [
    join(dir, `${base}_a.duckdb`),
    join(dir, `${base}_b.duckdb`),
  ].filter((candidate) => existsSync(candidate));

  if (candidates.length === 0) {
    return DUCKDB_PATH;
  }

  if (candidates.length === 1) {
    return candidates[0];
  }

  return candidates.sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs)[0];
}

export function getActiveDuckDbPath(): string {
  const manifest = readManifest();

  if (manifest === null) {
    const fallbackPath = resolveFallbackDuckDbPath();
    if (fallbackPath !== DUCKDB_PATH) {
      console.log(`[DuckDB Manifest] No manifest found, using detected versioned DB file: ${fallbackPath}`);
      return fallbackPath;
    }

    console.log("[DuckDB Manifest] No manifest found, using DUCKDB_PATH fallback");
    return DUCKDB_PATH;
  }

  const dir = dirname(DUCKDB_PATH);
  const base = basename(DUCKDB_PATH, ".duckdb");
  const activePath = join(dir, `${base}_${manifest.active}.duckdb`);

  console.log(`[DuckDB Manifest] Active: '${manifest.active}' (version ${manifest.version})`);
  return activePath;
}

export function getInactiveDuckDbPath(): string {
  const manifest = readManifest();

  const dir = dirname(DUCKDB_PATH);
  const base = basename(DUCKDB_PATH, ".duckdb");

  if (manifest === null) {
    return join(dir, `${base}_a.duckdb`);
  }

  const inactive = manifest.active === "a" ? "b" : "a";
  return join(dir, `${base}_${inactive}.duckdb`);
}

export function getManifestVersion(): number | null {
  const manifest = readManifest();
  return manifest?.version ?? null;
}
