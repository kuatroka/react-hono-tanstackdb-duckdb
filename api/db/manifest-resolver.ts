import { existsSync, readFileSync } from "node:fs";
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
        const snapshot: ResolvedDbSnapshot = {
          mode: "legacy-single-file",
          manifestVersion: null,
          manifestActive: null,
          dbPath: config.duckdbPath,
          source: "fallback-env",
          resolvedAt,
        };
        this.runtimeMode = "legacy-single-file";
        this.lastKnownGoodSnapshot = snapshot;
        this.lastManifestError = null;
        return snapshot;
      }

      const config = getDuckDbRuntimeConfig();
      const snapshot: ResolvedDbSnapshot = {
        mode: "manifest",
        manifestVersion: manifest.version,
        manifestActive: manifest.active,
        dbPath: getActivePathFor(config.duckdbPath, manifest.active),
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
      const snapshot: ResolvedDbSnapshot = {
        mode: "legacy-single-file",
        manifestVersion: null,
        manifestActive: null,
        dbPath: config.duckdbPath,
        source: "fallback-env",
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
