import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  FINGERPRINT_SCHEMA_VERSION,
  getFingerprintPath,
  preflightZeroRuntime,
  validateZeroRuntime,
} from "./zero-preflight.mjs";

const tempDirs = [];

function makeTempDir() {
  const dir = mkdtempSync(path.join(tmpdir(), "zero-preflight-"));
  tempDirs.push(dir);
  return dir;
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(value, null, 2));
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("validateZeroRuntime", () => {
  test("rejects unsupported Node 25 for Zero", () => {
    const result = validateZeroRuntime({
      nodeVersion: "v25.2.1",
      nativeModulePath: "/tmp/fake.node",
      nativeModuleExists: true,
      nativeModuleLoadError: null,
    });

    expect(result.ok).toBe(false);
    expect(result.problems.join(" ")).toContain("Node v25.2.1");
    expect(result.problems.join(" ")).toContain("Node 24.x");
  });

  test("rejects native module ABI mismatch under the current Node runtime", () => {
    const result = validateZeroRuntime({
      nodeVersion: "v24.14.1",
      nativeModulePath: "/tmp/fake.node",
      nativeModuleExists: true,
      nativeModuleLoadError:
        "The module was compiled against a different Node.js version using NODE_MODULE_VERSION 141. This version requires NODE_MODULE_VERSION 137.",
    });

    expect(result.ok).toBe(false);
    expect(result.problems.join(" ")).toContain("different Node.js version");
    expect(result.problems.join(" ")).toContain("Rebuild");
  });
});

describe("preflightZeroRuntime", () => {
  test("wipes an existing replica with unknown provenance when no fingerprint file exists", () => {
    const repoRoot = makeTempDir();
    const replicaFile = path.join(repoRoot, "tmp", "zero.db");
    mkdirSync(path.dirname(replicaFile), { recursive: true });
    writeFileSync(replicaFile, "replica");
    writeFileSync(`${replicaFile}-wal`, "wal");

    const result = preflightZeroRuntime({
      repoRoot,
      replicaFile,
      fingerprint: {
        schemaVersion: FINGERPRINT_SCHEMA_VERSION,
        zeroVersion: "1.0.0",
        zeroSqlite3Version: "1.0.15",
        nodeVersion: "v24.14.0",
        platform: "darwin",
        arch: "arm64",
      },
      runtimeValidation: { ok: true, problems: [] },
    });

    expect(result.ok).toBe(true);
    expect(result.replicaReset).toBe(true);
    expect(result.reasons.join(" ")).toContain("No runtime fingerprint found");
    expect(existsSync(replicaFile)).toBe(false);
    expect(existsSync(`${replicaFile}-wal`)).toBe(false);
    expect(existsSync(getFingerprintPath(repoRoot, replicaFile))).toBe(true);
  });

  test("keeps the replica when fingerprint is unchanged", () => {
    const repoRoot = makeTempDir();
    const replicaFile = path.join(repoRoot, "tmp", "zero.db");
    mkdirSync(path.dirname(replicaFile), { recursive: true });
    writeFileSync(replicaFile, "replica");

    const fingerprint = {
      schemaVersion: FINGERPRINT_SCHEMA_VERSION,
      zeroVersion: "1.0.0",
      zeroSqlite3Version: "1.0.15",
      nodeVersion: "v24.14.0",
      platform: "darwin",
      arch: "arm64",
    };
    writeJson(getFingerprintPath(repoRoot, replicaFile), fingerprint);

    const result = preflightZeroRuntime({
      repoRoot,
      replicaFile,
      fingerprint,
      runtimeValidation: { ok: true, problems: [] },
    });

    expect(result.ok).toBe(true);
    expect(result.replicaReset).toBe(false);
    expect(existsSync(replicaFile)).toBe(true);
  });

  test("wipes the replica when the Zero runtime fingerprint changes", () => {
    const repoRoot = makeTempDir();
    const replicaFile = path.join(repoRoot, "tmp", "zero.db");
    mkdirSync(path.dirname(replicaFile), { recursive: true });
    writeFileSync(replicaFile, "replica");
    writeFileSync(`${replicaFile}-shm`, "shm");

    writeJson(getFingerprintPath(repoRoot, replicaFile), {
      schemaVersion: FINGERPRINT_SCHEMA_VERSION,
      zeroVersion: "0.24.3000000000",
      zeroSqlite3Version: "0.24.0",
      nodeVersion: "v25.2.1",
      platform: "darwin",
      arch: "arm64",
    });

    const nextFingerprint = {
      schemaVersion: FINGERPRINT_SCHEMA_VERSION,
      zeroVersion: "1.0.0",
      zeroSqlite3Version: "1.0.15",
      nodeVersion: "v24.14.0",
      platform: "darwin",
      arch: "arm64",
    };

    const result = preflightZeroRuntime({
      repoRoot,
      replicaFile,
      fingerprint: nextFingerprint,
      runtimeValidation: { ok: true, problems: [] },
    });

    expect(result.ok).toBe(true);
    expect(result.replicaReset).toBe(true);
    expect(result.reasons.join(" ")).toContain("zeroVersion");
    expect(result.reasons.join(" ")).toContain("nodeVersion");
    expect(existsSync(replicaFile)).toBe(false);

    const stored = JSON.parse(readFileSync(getFingerprintPath(repoRoot, replicaFile), "utf8"));
    expect(stored).toEqual(nextFingerprint);
  });

  test("fails fast on unsupported runtime before mutating replica state", () => {
    const repoRoot = makeTempDir();
    const replicaFile = path.join(repoRoot, "tmp", "zero.db");
    mkdirSync(path.dirname(replicaFile), { recursive: true });
    writeFileSync(replicaFile, "replica");

    const result = preflightZeroRuntime({
      repoRoot,
      replicaFile,
      fingerprint: {
        schemaVersion: FINGERPRINT_SCHEMA_VERSION,
        zeroVersion: "1.0.0",
        zeroSqlite3Version: "1.0.15",
        nodeVersion: "v25.2.1",
        platform: "darwin",
        arch: "arm64",
      },
      runtimeValidation: {
        ok: false,
        problems: ["Node v25.2.1 is not supported by @rocicorp/zero-sqlite3; use Node 24.x."],
      },
    });

    expect(result.ok).toBe(false);
    expect(result.replicaReset).toBe(false);
    expect(existsSync(replicaFile)).toBe(true);
    expect(existsSync(getFingerprintPath(repoRoot, replicaFile))).toBe(false);
  });
});
