import { describe, expect, test } from "bun:test";

describe("AssetsTablePage", () => {
  test("uses collection preload instead of a live query on initial mount", async () => {
    const source = await Bun.file(new URL("./AssetsTable.tsx", import.meta.url)).text();

    expect(source).not.toContain("useLiveQuery");
    expect(source).toContain("await assetsCollection.preload()");
    expect(source).toContain("Array.from(assetsCollection.entries())");
  });
});
