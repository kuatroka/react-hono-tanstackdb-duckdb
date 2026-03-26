#!/usr/bin/env bun
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

export const FINGERPRINT_SCHEMA_VERSION = 1;
const SUPPORTED_NODE_MAJOR = new Set([20, 22, 23, 24]);

function parseMajor(version) {
  const match = /^v?(\d+)/.exec(version ?? "");
  return match ? Number(match[1]) : null;
}

function normalizeEnvValue(value) {
  return value?.trim().replace(/^['"]|['"]$/g, "") ?? "";
}

export function getFingerprintPath(repoRoot, replicaFile) {
  const safe = replicaFile.replace(/[^A-Za-z0-9._-]+/g, "_");
  return path.join(repoRoot, ".zero", `${safe}.fingerprint.json`);
}

export function validateZeroRuntime({ nodeVersion, nativeModulePath, nativeModuleExists, nativeModuleLoadError = null }) {
  const problems = [];
  const nodeMajor = parseMajor(nodeVersion);
  if (!nodeMajor || !SUPPORTED_NODE_MAJOR.has(nodeMajor)) {
    problems.push(
      `Node ${nodeVersion} is not supported by @rocicorp/zero-sqlite3; use Node 24.x (supported: 20.x, 22.x, 23.x, 24.x).`
    );
  }
  if (!nativeModuleExists) {
    problems.push(`Missing @rocicorp/zero-sqlite3 native module at ${nativeModulePath}. Run bun install or rebuild the package.`);
  }
  if (nativeModuleLoadError) {
    problems.push(
      `@rocicorp/zero-sqlite3 cannot load under ${nodeVersion}: ${nativeModuleLoadError}. Rebuild dependencies under the active Node runtime.`
    );
  }
  return { ok: problems.length === 0, problems };
}

function shallowDiff(previous, next) {
  const keys = new Set([...Object.keys(previous ?? {}), ...Object.keys(next ?? {})]);
  const diffs = [];
  for (const key of keys) {
    if ((previous ?? {})[key] !== (next ?? {})[key]) {
      diffs.push(`${key}: ${JSON.stringify((previous ?? {})[key])} -> ${JSON.stringify((next ?? {})[key])}`);
    }
  }
  return diffs;
}

function deleteReplicaFamily(replicaFile) {
  for (const suffix of ["", "-shm", "-wal", "-wal2"]) {
    rmSync(`${replicaFile}${suffix}`, { force: true, recursive: false });
  }
}

function readFingerprint(filePath) {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function writeFingerprint(filePath, fingerprint) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(fingerprint, null, 2) + "\n");
}

export function preflightZeroRuntime({ repoRoot, replicaFile, fingerprint, runtimeValidation }) {
  if (!runtimeValidation.ok) {
    return {
      ok: false,
      replicaReset: false,
      reasons: runtimeValidation.problems,
    };
  }

  const fingerprintPath = getFingerprintPath(repoRoot, replicaFile);
  const previous = readFingerprint(fingerprintPath);
  const replicaExists = ["", "-shm", "-wal", "-wal2"].some((suffix) => existsSync(`${replicaFile}${suffix}`));
  const reasons = [];
  let shouldReset = false;

  if (replicaExists && !previous) {
    shouldReset = true;
    reasons.push("No runtime fingerprint found for existing replica; wiping stale local Zero replica.");
  } else if (previous) {
    const diffs = shallowDiff(previous, fingerprint);
    if (diffs.length > 0) {
      shouldReset = replicaExists;
      reasons.push(...diffs);
    }
  }

  if (shouldReset) {
    deleteReplicaFamily(replicaFile);
  }

  writeFingerprint(fingerprintPath, fingerprint);

  return {
    ok: true,
    replicaReset: shouldReset,
    reasons,
    fingerprintPath,
  };
}

function getPackageJson(repoRoot, packageName) {
  const packageJsonPath = path.join(repoRoot, "node_modules", ...packageName.split("/"), "package.json");
  return {
    path: packageJsonPath,
    json: JSON.parse(readFileSync(packageJsonPath, "utf8")),
  };
}

function readEnvFile(repoRoot) {
  const envText = readFileSync(path.join(repoRoot, ".env"), "utf8");
  const env = {};
  for (const line of envText.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    env[line.slice(0, eq).trim()] = normalizeEnvValue(line.slice(eq + 1));
  }
  return env;
}

export function buildFingerprint({ zeroVersion, zeroSqlite3Version, nodeVersion, platform, arch }) {
  return {
    schemaVersion: FINGERPRINT_SCHEMA_VERSION,
    zeroVersion,
    zeroSqlite3Version,
    nodeVersion,
    platform,
    arch,
  };
}

function probeNativeModuleLoad(repoRoot) {
  const probe = spawnSync(
    process.execPath,
    ["-e", 'try { require("@rocicorp/zero-sqlite3"); process.stdout.write("ok"); } catch (error) { process.stderr.write(String(error?.message ?? error)); process.exit(1); }'],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: process.env,
    }
  );

  if (probe.status === 0) return null;
  return (probe.stderr || probe.stdout || `native module probe exited with status ${probe.status}`).trim();
}

export function runCli({ repoRoot = process.cwd(), stdout = console.log, stderr = console.error } = {}) {
  const env = readEnvFile(repoRoot);
  const replicaFile = env.ZERO_REPLICA_FILE || normalizeEnvValue(process.env.ZERO_REPLICA_FILE || "");
  if (!replicaFile) {
    stderr("Zero preflight failed: ZERO_REPLICA_FILE is missing.");
    return 1;
  }

  const zeroPkg = getPackageJson(repoRoot, "@rocicorp/zero").json;
  const sqlitePkg = getPackageJson(repoRoot, "@rocicorp/zero-sqlite3").json;
  const nativeModulePath = path.join(repoRoot, "node_modules", "@rocicorp", "zero-sqlite3", "build", "Release", "better_sqlite3.node");
  const runtimeValidation = validateZeroRuntime({
    nodeVersion: process.version,
    nativeModulePath,
    nativeModuleExists: existsSync(nativeModulePath),
    nativeModuleLoadError: existsSync(nativeModulePath) ? probeNativeModuleLoad(repoRoot) : null,
  });

  const fingerprint = buildFingerprint({
    zeroVersion: zeroPkg.version,
    zeroSqlite3Version: sqlitePkg.version,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
  });

  const result = preflightZeroRuntime({
    repoRoot,
    replicaFile,
    fingerprint,
    runtimeValidation,
  });

  if (!result.ok) {
    stderr("Zero preflight failed:");
    for (const problem of result.reasons) stderr(`- ${problem}`);
    return 1;
  }

  if (result.replicaReset) {
    stdout(`Zero preflight reset local replica at ${replicaFile}`);
    for (const reason of result.reasons) stdout(`- ${reason}`);
  } else {
    stdout(`Zero preflight OK for ${replicaFile}`);
  }
  return 0;
}

if (import.meta.main) {
  process.exit(runCli());
}
