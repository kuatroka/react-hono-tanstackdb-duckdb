#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

function normalizeEnvValue(value) {
  return value?.trim().replace(/^['"]|['"]$/g, "") ?? "";
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

function parsePortNumber(value, fallback) {
  try {
    const url = new URL(value);
    return url.port ? Number(url.port) : fallback;
  } catch {
    return fallback;
  }
}

function parseLsof(stdout) {
  return stdout
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const fields = line.split(/\s+/);
      return {
        command: fields[0] ?? "unknown",
        pid: fields[1] ?? "unknown",
      };
    });
}

function getRequiredPorts(env) {
  const apiPort = Number(env.API_PORT || process.env.API_PORT || "4000");
  const zeroPort = parsePortNumber(env.VITE_PUBLIC_SERVER || process.env.VITE_PUBLIC_SERVER || "http://localhost:4848", 4848);
  return [
    { port: 3001, label: "Vite UI" },
    { port: apiPort, label: "API server" },
    { port: zeroPort, label: "Zero cache" },
    { port: zeroPort + 1, label: "Zero change-streamer" },
  ];
}

export function checkRequiredPorts({
  repoRoot = process.cwd(),
  runCommand = (command, args) =>
    spawnSync(command, args, {
      cwd: repoRoot,
      encoding: "utf8",
      env: process.env,
    }),
} = {}) {
  const env = readEnvFile(repoRoot);
  const conflicts = [];

  for (const requiredPort of getRequiredPorts(env)) {
    const probe = runCommand("lsof", ["-nP", `-iTCP:${requiredPort.port}`, "-sTCP:LISTEN"]);
    if (probe.status === 0) {
      const processes = parseLsof(probe.stdout || "");
      if (processes.length > 0) {
        conflicts.push({ ...requiredPort, processes });
      }
    }
  }

  return {
    ok: conflicts.length === 0,
    conflicts,
  };
}

export function formatPortConflicts(conflicts) {
  const lines = ["Startup blocked: required local dev ports are already in use."];
  for (const conflict of conflicts) {
    const who = conflict.processes.map((proc) => `${proc.command} (pid ${proc.pid})`).join(", ");
    lines.push(`- Port ${conflict.port} is already in use for ${conflict.label}: ${who}`);
    lines.push(`  Inspect: lsof -nP -iTCP:${conflict.port} -sTCP:LISTEN`);
  }
  lines.push("Stop the stale process(es) above, then rerun bun run dev.");
  return lines.join("\n");
}

export function runCli({ repoRoot = process.cwd(), stdout = console.log, stderr = console.error } = {}) {
  const result = checkRequiredPorts({ repoRoot });
  if (result.ok) {
    stdout("Startup port guard OK.");
    return 0;
  }

  stderr(formatPortConflicts(result.conflicts));
  return 1;
}

if (import.meta.main) {
  process.exit(runCli());
}
