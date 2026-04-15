import { describe, expect, mock, test } from "bun:test";

describe("asset activity collection readiness", () => {
  test("writes fetched rows without waiting on preload when the collection starts eagerly", async () => {
    mock.module("./query-client", () => ({
      queryClient: {},
      loadPersistedAssetActivityData: async () => null,
      persistAssetActivityData: async () => undefined,
      loadPersistedInvestorFlowData: async () => null,
      persistInvestorFlowData: async () => undefined,
      loadPersistedDrilldownData: async () => null,
      persistDrilldownData: async () => undefined,
      clearPersistedDrilldownData: async () => undefined,
      clearPersistedInvestorFlowData: async () => undefined,
    }));

    let collectionStarted = false;
    let writeUpsertCalls = 0;

    mock.module("@tanstack/db", () => ({
      createCollection: (options: { startSync?: boolean }) => {
        collectionStarted = options.startSync === true;
        return {
          entries: () => new Map().entries(),
          utils: {
            writeUpsert: () => {
              if (!collectionStarted) {
                throw new Error("SyncNotInitializedError");
              }
              writeUpsertCalls += 1;
            },
            writeDelete: () => undefined,
          },
        };
      },
    }));

    mock.module("@tanstack/query-db-collection", () => ({
      queryCollectionOptions: (options: unknown) => options,
    }));

    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          rows: [
            {
              quarter: "2024-Q4",
              numOpen: 7,
              numAdd: 3,
              numReduce: 1,
              numClose: 2,
              numHold: 4,
              cusip: "12345678",
              ticker: "ABC",
              opened: 7,
              closed: 2,
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );

    const { fetchAssetActivityData } = await import("./asset-activity");
    const result = await Promise.race([
      fetchAssetActivityData("ABC", "12345678").then(() => "resolved"),
      Bun.sleep(25).then(() => "timeout"),
    ]);

    expect(collectionStarted).toBe(true);
    expect(result).toBe("resolved");
    expect(writeUpsertCalls).toBe(1);
  });
});
