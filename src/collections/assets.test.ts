import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { QueryClient } from "@tanstack/query-core";
import * as queryClientModule from "./query-client";
import { createAssetsCollection } from "./assets";

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
    expect(Array.from(collection.entries()).map(([, value]) => value)).toEqual(rows);
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

    spyOn(queryClientModule, "loadPersistedAssetListData").mockResolvedValue({
      key: "assets-v1",
      rows,
      metadata: { persistedAt: Date.now() },
    });
    const fetchSpy = spyOn(globalThis, "fetch");

    const collection = createAssetsCollection(new QueryClient());
    await collection.preload();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(Array.from(collection.entries()).map(([, value]) => value)).toEqual(rows);
  });
});
