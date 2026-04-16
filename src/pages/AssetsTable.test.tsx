import { describe, expect, test } from "bun:test";

describe("AssetsTablePage", () => {
  test("uses incremental infinite loading instead of preloading the full assets collection", async () => {
    const source = await Bun.file(new URL("./AssetsTable.tsx", import.meta.url)).text();

    expect(source).toContain("useInfiniteQuery");
    expect(source).toContain("getNextPageParam");
    expect(source).toContain("onLoadMore={assetsQuery.fetchNextPage}");
    expect(source).toContain("hasNextPage={assetsQuery.hasNextPage}");
    expect(source).not.toContain("await assetsCollection.preload()");
    expect(source).not.toContain("Array.from(assetsCollection.entries())");
  });
});
