import { describe, expect, test } from "bun:test";

describe("AssetsTablePage", () => {
  test("preloads the persisted assets collection so repeat visits and table search stay local", async () => {
    const source = await Bun.file(new URL("./AssetsTable.tsx", import.meta.url)).text();

    expect(source).toContain("await assetsCollection.preload()");
    expect(source).toContain("Array.from(assetsCollection.entries())");
    expect(source).toContain("useMarkContentReady");
    expect(source).toContain("subscribeAssetListLoadSource");
    expect(source).toContain("getAssetListLoadSource");
    expect(source).toContain("clientPageSize={100}");
    expect(source).not.toContain("onReady={onReady}");
    expect(source).not.toContain("useSearch");
    expect(source).not.toContain("useNavigate");
    expect(source).not.toContain("onSearchChange={handleSearchChange}");
    expect(source).not.toContain("searchValue={trimmedSearch}");
    expect(source).not.toContain("useInfiniteQuery");
    expect(source).not.toContain("getNextPageParam");
    expect(source).not.toContain("onLoadMore={assetsQuery.fetchNextPage}");
    expect(source).not.toContain("hasNextPage={assetsQuery.hasNextPage}");
  });

  test("keeps search telemetry inside the table header instead of duplicating it in the page chrome", async () => {
    const source = await Bun.file(new URL("./AssetsTable.tsx", import.meta.url)).text();

    expect(source).toContain("const [tableTelemetry, setTableTelemetry]");
    expect(source).not.toContain("const [searchTelemetry, setSearchTelemetry]");
    expect(source).not.toContain("<LatencyBadge telemetry={searchTelemetry}");
    expect(source).not.toContain("onSearchTelemetryChange={setSearchTelemetry}");
  });
});
