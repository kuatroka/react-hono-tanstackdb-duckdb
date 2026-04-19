import { describe, expect, test } from "bun:test";
import { createRuntimeSearchIndex, searchRuntimeIndex } from "./searches";

describe("searchRuntimeIndex", () => {
  const runtimeIndex = createRuntimeSearchIndex({
    items: [
      [1, "98976E400", "ZOOM", "Zoom Video", "assets"],
      [2, null, "DIS", "Walt Disney", "assets"],
      [3, null, "898371", "Citadel Advisors", "superinvestors"],
    ],
    metadata: {
      totalItems: 3,
    },
  });

  test("returns exact code matches ahead of broader results", () => {
    const results = searchRuntimeIndex(runtimeIndex, "zoom");

    expect(results[0]).toMatchObject({
      id: 1,
      code: "ZOOM",
      score: 100,
    });
  });

  test("returns prefix matches from the compact two-character buckets", () => {
    const results = searchRuntimeIndex(runtimeIndex, "ci");

    expect(results[0]).toMatchObject({
      id: 3,
      name: "Citadel Advisors",
      score: 40,
    });
  });

  test("falls back to substring scans when the query is not a prefix", () => {
    const results = searchRuntimeIndex(runtimeIndex, "isne");

    expect(results[0]).toMatchObject({
      id: 2,
      name: "Walt Disney",
      score: 20,
    });
  });
});
