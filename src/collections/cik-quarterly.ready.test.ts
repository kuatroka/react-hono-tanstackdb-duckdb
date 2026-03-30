import { describe, expect, test } from "bun:test";

const fixture = String.raw`
  import { mock } from "bun:test";

  mock.module("./query-client", () => ({
    queryClient: {},
    loadPersistedCikQuarterlyData: async () => null,
    persistCikQuarterlyData: async () => undefined,
    clearPersistedCikQuarterlyData: async () => undefined,
  }));

  let collectionStarted = false;
  let writeUpsertCalls = 0;
  let preloadCalls = 0;

  mock.module("@tanstack/db", () => ({
    createCollection: (options) => {
      collectionStarted = options.startSync === true;
      return {
        entries: () => new Map().entries(),
        preload: () => {
          preloadCalls += 1;
          return new Promise(() => undefined);
        },
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
    queryCollectionOptions: (options) => options,
  }));

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify([
        {
          cik: "898371",
          quarter: "2024Q4",
          quarterEndDate: "2024-12-31",
          totalValue: 123,
          totalValuePrcChg: 1.5,
          numAssets: 2,
        },
      ]),
      { status: 200, headers: { "content-type": "application/json" } },
    );

  const { fetchCikQuarterlyData } = await import("./cik-quarterly");
  const result = await Promise.race([
    fetchCikQuarterlyData("898371").then(() => "resolved"),
    Bun.sleep(25).then(() => "timeout"),
  ]);

  if (result !== "resolved") {
    throw new Error("unexpected result: " + result);
  }
  if (writeUpsertCalls !== 1) {
    throw new Error("writeUpsertCalls=" + writeUpsertCalls);
  }
  if (preloadCalls !== 0) {
    throw new Error("preloadCalls=" + preloadCalls);
  }
`;

describe("cik quarterly collection readiness", () => {
  test("writes fetched rows without waiting on preload when the collection starts eagerly", async () => {
    const proc = Bun.spawn(["bun", "-e", fixture], {
      cwd: import.meta.dir,
      stdout: "pipe",
      stderr: "pipe",
      env: process.env,
    });

    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    expect(stdout).toContain("[CikQuarterly] Fetched 1 quarters for CIK 898371");
    expect(stderr.trim()).toBe("");
    expect(exitCode).toBe(0);
  });
});
