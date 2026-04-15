import { describe, expect, mock, test } from "bun:test";

describe("investor flow collection readiness", () => {
  test("writes fetched rows without waiting on preload when the collection starts eagerly", async () => {
    mock.module("./query-client", () => ({
      queryClient: {},
      loadPersistedInvestorFlowData: async () => null,
      persistInvestorFlowData: async () => undefined,
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
              inflow: 13,
              outflow: 9,
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );

    const { fetchInvestorFlowData } = await import("./investor-flow");
    const result = await Promise.race([
      fetchInvestorFlowData("ABC").then(() => "resolved"),
      Bun.sleep(25).then(() => "timeout"),
    ]);

    expect(collectionStarted).toBe(true);
    expect(result).toBe("resolved");
    expect(writeUpsertCalls).toBe(1);
  });
});
