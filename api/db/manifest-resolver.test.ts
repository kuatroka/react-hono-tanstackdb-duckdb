import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ManifestResolver } from "./manifest-resolver";

const createdDirs: string[] = [];

afterEach(() => {
  for (const dir of createdDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
  delete process.env.DUCKDB_PATH;
});

describe("ManifestResolver", () => {
  test("falls back to newest versioned DuckDB file when manifest is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "duckdb-manifest-resolver-"));
    createdDirs.push(dir);

    const duckdbPath = join(dir, "main.duckdb");
    const aPath = join(dir, "main_a.duckdb");
    const bPath = join(dir, "main_b.duckdb");

    writeFileSync(aPath, "a");
    writeFileSync(bPath, "b");

    const older = new Date("2026-04-14T00:00:00.000Z");
    const newer = new Date("2026-04-14T00:05:57.000Z");
    utimesSync(aPath, older, older);
    utimesSync(bPath, newer, newer);

    process.env.DUCKDB_PATH = duckdbPath;

    const resolver = new ManifestResolver();
    const snapshot = resolver.resolveSnapshot();

    expect(snapshot.mode).toBe("legacy-single-file");
    expect(snapshot.dbPath).toBe(bPath);
    expect(snapshot.source).toBe("fallback-versioned-file");
    expect(snapshot.fileMtimeMs).not.toBeNull();
  });

  test("tracks file mtime for manifest-backed snapshot", () => {
    const dir = mkdtempSync(join(tmpdir(), "duckdb-manifest-resolver-manifest-"));
    createdDirs.push(dir);

    const duckdbPath = join(dir, "main.duckdb");
    const activePath = join(dir, "main_a.duckdb");
    const manifestPath = join(dir, "db_manifest.json");

    writeFileSync(activePath, "a");
    writeFileSync(manifestPath, JSON.stringify({ active: "a", version: 7, lastUpdated: new Date().toISOString() }));
    process.env.DUCKDB_PATH = duckdbPath;

    const resolver = new ManifestResolver();
    const snapshot = resolver.resolveSnapshot();

    expect(snapshot.mode).toBe("manifest");
    expect(snapshot.dbPath).toBe(activePath);
    expect(snapshot.source).toBe("manifest");
    expect(snapshot.fileMtimeMs).not.toBeNull();
  });
});
