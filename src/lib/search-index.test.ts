import { describe, expect, test } from "bun:test";
import { compactSearchIndexPayload } from "./search-index";

describe("compactSearchIndexPayload", () => {
  test("converts the legacy object-map payload into compact tuples", () => {
    const payload = compactSearchIndexPayload({
      codeExact: { zoom: [1] },
      codePrefixes: { zo: [1] },
      namePrefixes: { zo: [1] },
      items: {
        "1": {
          id: 1,
          cusip: "98976E400",
          code: "ZOOM",
          name: "Zoom Video",
          category: "assets",
        },
      },
      metadata: {
        totalItems: 1,
        generatedAt: "2026-04-19T00:00:00.000Z",
      },
    });

    expect(payload).toEqual({
      items: [[1, "98976E400", "ZOOM", "Zoom Video", "assets"]],
      metadata: {
        totalItems: 1,
        generatedAt: "2026-04-19T00:00:00.000Z",
      },
    });
  });

  test("normalizes already-compact tuple payloads", () => {
    const payload = compactSearchIndexPayload({
      items: [[2, null, "DIS", "Walt Disney", "assets"]],
      metadata: {
        totalItems: 1,
      },
    });

    expect(payload).toEqual({
      items: [[2, null, "DIS", "Walt Disney", "assets"]],
      metadata: {
        totalItems: 1,
      },
    });
  });
});
