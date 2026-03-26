#!/usr/bin/env node
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const logPath = process.argv[2];
const timeoutMs = Number.parseInt(process.argv[3] ?? "600000", 10);
const failurePatterns = [
  /relation\s+"zero_0\/cvr\.instances"\s+does not exist/i,
  /EADDRINUSE/i,
  /address already in use/i,
  /status":"ERROR"/i,
  /CONNECTION_CLOSED/i,
  /exiting with error/i,
];

if (!logPath) {
  console.error("Usage: verify-zero-ready.mjs <logPath> [timeoutMs]");
  process.exit(2);
}

function portIsListening(port) {
  try {
    const output = execFileSync("bash", ["-lc", `lsof -nP -iTCP:${port} -sTCP:LISTEN | tail -n +2`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return output.trim().length > 0;
  } catch {
    return false;
  }
}

const start = Date.now();
while (Date.now() - start < timeoutMs) {
  const text = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8") : "";
  if (failurePatterns.some((pattern) => pattern.test(text))) {
    console.error(text);
    process.exit(1);
  }
  if (portIsListening(4848)) {
    process.exit(0);
  }
  await new Promise((resolve) => setTimeout(resolve, 5000));
}

if (fs.existsSync(logPath)) {
  console.error(fs.readFileSync(logPath, "utf8"));
}
console.error(`Timed out waiting for Zero readiness in ${logPath}`);
process.exit(1);
