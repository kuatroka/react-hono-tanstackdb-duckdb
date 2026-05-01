import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { QueryClient } from "@tanstack/query-core";
import { clearAssetListSessionState, createAssetsCollection, getLoadedAssetList, __setAssetListPersistenceForTest } from "./assets";

describe("assets collection", () => {
  afterEach(() => {
    mock.restore();
  });

  test("hydrates from the paged assets API response so the root table can persist the full list locally", async () => {
    const rows = [
      {
        id: "AAPL-037833100",
        asset: "AAPL",
        assetName: "Apple Inc",
        cusip: "037833100",
      },
    ];

    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ rows, nextOffset: null, source: "api-duckdb" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const collection = createAssetsCollection(new QueryClient());
    await collection.preload();

    expect(fetchSpy).toHaveBeenCalledWith("/api/assets?limit=50000&offset=0&sort=assetName&direction=asc");
    expect(Array.from(collection.entries()).map(([, value]) => value)).toMatchObject(rows);
    expect(getLoadedAssetList()).toMatchObject(rows);
  });

  test("reuses persisted IndexedDB rows on repeat visits without kicking off another assets API fetch", async () => {
    const rows = [
      {
        id: "MSFT-594918104",
        asset: "MSFT",
        assetName: "Microsoft Corp",
        cusip: "594918104",
      },
    ];

    const restorePersistence = __setAssetListPersistenceForTest({
      loadPersistedAssetListData: async () => ({
        key: "assets-v1",
        rows,
        metadata: { persistedAt: Date.now() },
      }),
    });
    const fetchSpy = spyOn(globalThis, "fetch");

    const collection = createAssetsCollection(new QueryClient());
    await collection.preload();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(Array.from(collection.entries()).map(([, value]) => value)).toMatchObject(rows);
    expect(getLoadedAssetList()).toMatchObject(rows);
    restorePersistence();
  });

  test("clears collection-backed list rows without retaining a duplicate module array", async () => {
    const rows = [
      {
        id: "GOOG-02079K305",
        asset: "GOOG",
        assetName: "Alphabet Inc",
        cusip: "02079K305",
      },
    ];

    spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ rows, nextOffset: null, source: "api-duckdb" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const queryClient = new QueryClient();
    const collection = createAssetsCollection(queryClient);
    await collection.preload();
    expect(queryClient.getQueryCache().find({ queryKey: ["assets"] })).toBeDefined();
    expect(getLoadedAssetList()).toHaveLength(1);

    clearAssetListSessionState();

    expect(getLoadedAssetList()).toEqual([]);
    expect(queryClient.getQueryCache().find({ queryKey: ["assets"] })).toBeUndefined();
  });
});
