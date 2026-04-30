import { describe, expect, test } from "bun:test";
import { app } from "./index";

describe("cik-quarterly route concurrency", () => {
  test("serves a superinvestor detail fetch and quarterly fetch concurrently for the same cik", async () => {
    const cik = "9235";

    const [recordResponse, quarterlyResponse] = await Promise.all([
      app.request(`/api/superinvestors/${cik}`),
      app.request(`/api/cik-quarterly/${cik}`),
    ]);

    expect(recordResponse.status).toBe(200);
    expect(quarterlyResponse.status).toBe(200);

    const record = await recordResponse.json();
    const quarterly = await quarterlyResponse.json();

    expect(record).toMatchObject({ cik });
    expect(Array.isArray(quarterly.rows)).toBe(true);
    expect(quarterly.rows.length).toBeGreaterThan(0);
  });
});
