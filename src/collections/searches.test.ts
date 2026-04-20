import { describe, expect, test } from "bun:test";
import { decodeSearchIndexItems } from "./searches";

describe("decodeSearchIndexItems", () => {
  test("turns compact tuple docs into search result records", () => {
    const items = decodeSearchIndexItems({
      items: [
        [1, "98976E400", "ZOOM", "Zoom Video", "assets"],
        [2, null, "898371", "Citadel Advisors", "superinvestors"],
      ],
      metadata: {
        totalItems: 2,
      },
    });

    expect(items).toEqual([
      {
        id: 1,
        cusip: "98976E400",
        code: "ZOOM",
        name: "Zoom Video",
        category: "assets",
      },
      {
        id: 2,
        cusip: null,
        code: "898371",
        name: "Citadel Advisors",
        category: "superinvestors",
      },
    ]);
  });
});
