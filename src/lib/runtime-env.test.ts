import { describe, expect, test } from "bun:test";
import { shouldEnableReactScan } from "./runtime-env";

describe("runtime env helpers", () => {
  test("enables react-scan for Bun-served localhost development even without import.meta.env", () => {
    expect(
      shouldEnableReactScan({
        hostname: "localhost",
        importMetaEnvDev: undefined,
      })
    ).toBe(true);
  });

  test("keeps react-scan enabled for Vite-style development envs", () => {
    expect(
      shouldEnableReactScan({
        hostname: "example.com",
        importMetaEnvDev: true,
      })
    ).toBe(true);
  });

  test("allows benchmark and profiling runs to disable react-scan explicitly", () => {
    expect(
      shouldEnableReactScan({
        hostname: "127.0.0.1",
        importMetaEnvDev: true,
        reactScanDisabled: true,
      })
    ).toBe(false);
  });

  test("disables react-scan for non-local production hosts", () => {
    expect(
      shouldEnableReactScan({
        hostname: "fintellectus-tanstackdb.206.168.212.173.sslip.io",
        importMetaEnvDev: undefined,
      })
    ).toBe(false);
  });
});
