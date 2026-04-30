import { readFileSync, existsSync } from "node:fs";
import { dirname, join, basename } from "node:path";

function getDuckDbPath() {
  const value = process.env.DUCKDB_PATH?.trim();
  if (!value) {
    throw new Error("Missing required environment variable: DUCKDB_PATH");
  }
  return value;
}

export interface DbManifest {
  active: "a" | "b";
  version: number;
  lastUpdated: string;
}

function getManifestPath(): string {
  return join(dirname(getDuckDbPath()), "db_manifest.json");
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

export function getActiveDuckDbPath(): string {
  const manifest = readManifest();
  const duckdbPath = getDuckDbPath();

  if (manifest === null) {
    console.log("[DuckDB Manifest] No manifest found, using DUCKDB_PATH fallback");
    return duckdbPath;
  }

  const dir = dirname(duckdbPath);
  const base = basename(duckdbPath, ".duckdb");
  const activePath = join(dir, `${base}_${manifest.active}.duckdb`);

  console.log(`[DuckDB Manifest] Active: '${manifest.active}' (version ${manifest.version})`);
  return activePath;
}

export function getInactiveDuckDbPath(): string {
  const manifest = readManifest();
  const duckdbPath = getDuckDbPath();

  const dir = dirname(duckdbPath);
  const base = basename(duckdbPath, ".duckdb");

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
