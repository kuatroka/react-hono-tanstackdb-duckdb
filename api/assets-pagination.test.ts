import { describe, expect, test } from "bun:test";
import { app } from "./index";

describe("assets list route", () => {
  test("supports paged responses with search and sort metadata for infinite assets loading", async () => {
    const response = await app.request("/api/assets?limit=5&offset=0&search=app&sort=assetName&direction=asc");

    expect(response.status).toBe(200);

    const payload = await response.json() as {
      rows?: unknown[];
      nextOffset?: number | null;
    } | unknown[];

    expect(Array.isArray(payload)).toBe(false);
    expect(Array.isArray((payload as { rows?: unknown[] }).rows)).toBe(true);
    expect("nextOffset" in (payload as object)).toBe(true);
  });
});
