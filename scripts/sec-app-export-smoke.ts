#!/usr/bin/env bun
import { spawn } from "node:child_process";
import { buildSecAppExportCommand } from "./sec-app-export-smoke-lib";

const child = spawn("bash", ["-lc", buildSecAppExportCommand()], {
  stdio: "inherit",
});

const exitCode = await new Promise<number>((resolve, reject) => {
  child.on("error", reject);
  child.on("exit", (code) => resolve(code ?? 1));
});

if (exitCode !== 0) {
  process.exit(exitCode);
}
