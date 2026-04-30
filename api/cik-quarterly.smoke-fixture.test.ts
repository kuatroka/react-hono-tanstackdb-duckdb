import { describe, expect, test } from "bun:test";
import { app } from "./index";

describe("cik-quarterly smoke fixture", () => {
  test("fixture cik 898371 returns enough quarterly points for the chart smoke test", async () => {
    const response = await app.request("/api/cik-quarterly/898371");

    expect(response.status).toBe(200);

    const payload = await response.json();

    expect(Array.isArray(payload.rows)).toBe(true);
    expect(payload.rows.length).toBeGreaterThan(5);
  });
});
