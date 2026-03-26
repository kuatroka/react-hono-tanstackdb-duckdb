#!/usr/bin/env bun
import { afterEach, describe, expect, test } from "bun:test";
import { checkRequiredPorts, formatPortConflicts } from "./startup-port-guard.mjs";

const originalEnv = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(originalEnv)) {
    process.env[key] = value;
  }
});

describe("checkRequiredPorts", () => {
  test("reports occupied startup ports with process details", () => {
    process.env.API_PORT = "4001";
    process.env.VITE_PUBLIC_SERVER = "http://localhost:4848";

    const result = checkRequiredPorts({
      runCommand(command, args) {
        if (command !== "lsof") {
          throw new Error(`Unexpected command: ${command}`);
        }

        const port = args[1]?.replace(/^-?i?TCP:/, "");
        if (port === "4001") {
          return {
            status: 0,
            stdout: "COMMAND   PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME\nbun     14495 yo  171u  IPv6 0x1      0t0  TCP *:4001 (LISTEN)\n",
            stderr: "",
          };
        }

        if (port === "4849") {
          return {
            status: 0,
            stdout: "COMMAND   PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME\nnode    14523 yo   21u  IPv6 0x2      0t0  TCP *:4849 (LISTEN)\n",
            stderr: "",
          };
        }

        return {
          status: 1,
          stdout: "",
          stderr: "",
        };
      },
    });

    expect(result.ok).toBe(false);
    expect(result.conflicts).toEqual([
      {
        port: 4001,
        label: "API server",
        processes: [{ command: "bun", pid: "14495" }],
      },
      {
        port: 4849,
        label: "Zero change-streamer",
        processes: [{ command: "node", pid: "14523" }],
      },
    ]);

    const message = formatPortConflicts(result.conflicts);
    expect(message).toContain("Port 4001 is already in use for API server");
    expect(message).toContain("bun (pid 14495)");
    expect(message).toContain("Port 4849 is already in use for Zero change-streamer");
    expect(message).toContain("lsof -nP -iTCP:4001 -sTCP:LISTEN");
  });

  test("passes when all required startup ports are available", () => {
    process.env.API_PORT = "4001";
    process.env.VITE_PUBLIC_SERVER = "http://localhost:4848";

    const result = checkRequiredPorts({
      runCommand() {
        return {
          status: 1,
          stdout: "",
          stderr: "",
        };
      },
    });

    expect(result).toEqual({ ok: true, conflicts: [] });
  });
});
