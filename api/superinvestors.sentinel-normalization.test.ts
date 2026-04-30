import { describe, expect, test } from "bun:test";
import { app } from "./index";

const SENTINEL = "!!! no cik_name found !!!";

describe("superinvestor name normalization", () => {
  test("replaces DuckDB sentinel names on the superinvestor detail route", async () => {
    const response = await app.request("/api/superinvestors/898371");

    expect(response.status).toBe(200);

    const record = await response.json();

    expect(record.cik).toBe("898371");
    expect(record.cikName).not.toBe(SENTINEL);
    expect(String(record.cikName)).toContain("898371");
  });

  test("does not expose DuckDB sentinel names through the superinvestor list route", async () => {
    const response = await app.request("/api/superinvestors?limit=50");

    expect(response.status).toBe(200);

    const payload = await response.json();

    expect(Array.isArray(payload.rows)).toBe(true);
    expect(payload.rows.some((row: { cikName: string }) => row.cikName === SENTINEL)).toBe(false);
  });

  test("does not expose DuckDB sentinel names through search results", async () => {
    const response = await app.request("/api/duckdb-search?q=898371&limit=5");

    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(Array.isArray(payload.results)).toBe(true);
    expect(payload.results.some((row: { name: string }) => row.name === SENTINEL)).toBe(false);
  });
});
