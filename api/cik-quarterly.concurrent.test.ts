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
    expect(Array.isArray(quarterly)).toBe(true);
    expect(quarterly.length).toBeGreaterThan(0);
  });

  test("keeps returning 200 for repeated concurrent quarterly requests on the shared connection", async () => {
    const cik = "898371";

    const responses = await Promise.all(
      Array.from({ length: 50 }, () => app.request(`/api/cik-quarterly/${cik}`)),
    );

    expect(responses.every((response) => response.status === 200)).toBe(true);
  });

  test("keeps quarterly and superinvestor detail requests stable under repeated mixed concurrency", async () => {
    const cik = "898371";

    for (let round = 0; round < 20; round += 1) {
      const responses = await Promise.all(
        Array.from({ length: 25 }, () => [
          app.request(`/api/cik-quarterly/${cik}`),
          app.request(`/api/superinvestors/${cik}`),
        ]).flat(),
      );

      expect(responses.every((response) => response.status === 200)).toBe(true);
    }
  });
});
