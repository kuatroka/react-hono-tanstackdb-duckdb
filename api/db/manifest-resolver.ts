import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { getDuckDbRuntimeConfig } from "./config";
import { ManifestResolutionError } from "./errors";
import { dbManifestSchema } from "./manifest-schema";
import type { DbManifest, ResolvedDbSnapshot } from "./types";

function getManifestPathFor(duckdbPath: string) {
  return join(dirname(duckdbPath), "db_manifest.json");
}

function getActivePathFor(duckdbPath: string, active: DbManifest["active"]) {
  const dir = dirname(duckdbPath);
  const base = basename(duckdbPath, ".duckdb");
  return join(dir, `${base}_${active}.duckdb`);
}

function getFileMtimeMs(path: string): number | null {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return null;
  }
}

function resolveFallbackDuckDbPath(duckdbPath: string): { path: string; source: "fallback-env" | "fallback-versioned-file" } {
  if (existsSync(duckdbPath)) {
    return { path: duckdbPath, source: "fallback-env" };
  }

  const dir = dirname(duckdbPath);
  const base = basename(duckdbPath, ".duckdb");
  const candidates = [
    join(dir, `${base}_a.duckdb`),
    join(dir, `${base}_b.duckdb`),
  ].filter((candidate) => existsSync(candidate));

  if (candidates.length === 0) {
    return { path: duckdbPath, source: "fallback-env" };
  }

  if (candidates.length === 1) {
    return { path: candidates[0], source: "fallback-versioned-file" };
  }

  const newest = candidates.sort((left, right) => (getFileMtimeMs(right) ?? 0) - (getFileMtimeMs(left) ?? 0))[0];
  return { path: newest, source: "fallback-versioned-file" };
}

export class ManifestResolver {
  private lastKnownGoodSnapshot: ResolvedDbSnapshot | null = null;
  private runtimeMode: "manifest" | "legacy-single-file" | null = null;
  private lastManifestError: string | null = null;

  getManifestPath() {
    return getManifestPathFor(getDuckDbRuntimeConfig().duckdbPath);
  }

  getLastManifestError() {
    return this.lastManifestError;
  }

  getRuntimeMode() {
    return this.runtimeMode;
  }

  getLastKnownGoodSnapshot() {
    return this.lastKnownGoodSnapshot;
  }

  readManifest(): DbManifest | null {
    const manifestPath = this.getManifestPath();
    if (!existsSync(manifestPath)) {
      return null;
    }

    try {
      const content = readFileSync(manifestPath, "utf-8");
      return dbManifestSchema.parse(JSON.parse(content));
    } catch (error) {
      this.lastManifestError = error instanceof Error ? error.message : String(error);
      throw new ManifestResolutionError(`Failed to read manifest at ${manifestPath}`, error);
    }
  }

  resolveSnapshot(): ResolvedDbSnapshot {
    const resolvedAt = Date.now();

    try {
      const manifest = this.readManifest();
      if (manifest === null) {
        if (this.runtimeMode === "manifest" && this.lastKnownGoodSnapshot) {
          this.lastManifestError = "Manifest missing after manifest-mode startup; keeping last-known-good snapshot";
          return this.lastKnownGoodSnapshot;
        }

        const config = getDuckDbRuntimeConfig();
        const fallback = resolveFallbackDuckDbPath(config.duckdbPath);
        const snapshot: ResolvedDbSnapshot = {
          mode: "legacy-single-file",
          manifestVersion: null,
          manifestActive: null,
          dbPath: fallback.path,
          fileMtimeMs: getFileMtimeMs(fallback.path),
          source: fallback.source,
          resolvedAt,
        };
        this.runtimeMode = "legacy-single-file";
        this.lastKnownGoodSnapshot = snapshot;
        this.lastManifestError = null;
        return snapshot;
      }

      const config = getDuckDbRuntimeConfig();
      const dbPath = getActivePathFor(config.duckdbPath, manifest.active);
      const snapshot: ResolvedDbSnapshot = {
        mode: "manifest",
        manifestVersion: manifest.version,
        manifestActive: manifest.active,
        dbPath,
        fileMtimeMs: getFileMtimeMs(dbPath),
        source: "manifest",
        resolvedAt,
      };

      this.runtimeMode = "manifest";
      this.lastKnownGoodSnapshot = snapshot;
      this.lastManifestError = null;
      return snapshot;
    } catch {
      if (this.lastKnownGoodSnapshot) {
        return this.lastKnownGoodSnapshot;
      }

      const config = getDuckDbRuntimeConfig();
      const fallback = resolveFallbackDuckDbPath(config.duckdbPath);
      const snapshot: ResolvedDbSnapshot = {
        mode: "legacy-single-file",
        manifestVersion: null,
        manifestActive: null,
        dbPath: fallback.path,
        fileMtimeMs: getFileMtimeMs(fallback.path),
        source: fallback.source,
        resolvedAt,
      };
      this.runtimeMode = "legacy-single-file";
      this.lastKnownGoodSnapshot = snapshot;
      return snapshot;
    }
  }
}

export const manifestResolver = new ManifestResolver();

export function getManifestPath() {
  return manifestResolver.getManifestPath();
}

export function getInactiveDuckDbPathFromSnapshot(snapshot: ResolvedDbSnapshot) {
  if (snapshot.manifestActive === null) {
    return getActivePathFor(getDuckDbRuntimeConfig().duckdbPath, "a");
  }

  return getActivePathFor(getDuckDbRuntimeConfig().duckdbPath, snapshot.manifestActive === "a" ? "b" : "a");
}
