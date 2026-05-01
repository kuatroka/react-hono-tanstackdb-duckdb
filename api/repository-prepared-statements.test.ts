import { describe, expect, test } from "bun:test";
import type { DuckDbLease } from "./db/types";
import { DUCKDB_LEASE_CONTEXT_KEY } from "./db/hono-types";
import { fullDumpSearches, searchDuckDb } from "./repositories/search-repository";
import { getAllAssetsActivity } from "./repositories/all-assets-activity-repository";
import { getInvestorFlow } from "./repositories/investor-flow-repository";
import { getInvestorDrilldown } from "./repositories/investor-drilldown-repository";
import { getCikQuarterly } from "./repositories/cik-quarterly-repository";
import { listAssets } from "./repositories/assets-repository";
import { listSuperinvestors } from "./repositories/superinvestors-repository";
import { getSuperinvestorAssetHistory } from "./repositories/superinvestor-asset-history-repository";

type MockPreparedStatement = {
  bindInteger: (index: number, value: number) => void;
  bindVarchar: (index: number, value: string) => void;
  bindNull: (index: number) => void;
  runAndReadAll: () => Promise<{ getRows: () => unknown[][] }>;
};

type MockConnection = {
  prepare?: (sql: string) => Promise<MockPreparedStatement>;
  runAndReadAll?: (sql: string) => Promise<{ getRows: () => unknown[][] }>;
};

function createMockStatement(rows: unknown[][], binds: Array<{ index: number; value: unknown }>): MockPreparedStatement {
  return {
    bindInteger(index, value) {
      binds.push({ index, value });
    },
    bindVarchar(index, value) {
      binds.push({ index, value });
    },
    bindNull(index) {
      binds.push({ index, value: null });
    },
    async runAndReadAll() {
      return {
        getRows: () => rows,
      };
    },
  };
}

function createContext(connectionFactory: () => MockConnection) {
  const lease: DuckDbLease = {
    generationId: "test-generation",
    snapshot: {
      mode: "manifest",
      manifestVersion: 1,
      manifestActive: "a",
      dbPath: "/tmp/test.duckdb",
      fileMtimeMs: Date.now(),
      source: "manifest",
      resolvedAt: Date.now(),
    },
    async run(_queryName, run) {
      return run(connectionFactory() as never);
    },
    async close() {},
  };

  return {
    get(key: typeof DUCKDB_LEASE_CONTEXT_KEY) {
      return key === DUCKDB_LEASE_CONTEXT_KEY ? lease : undefined;
    },
  };
}

describe("prepared statement repository regressions", () => {
  test("search full dump binds cursor and limit safely", async () => {
    const binds: Array<{ index: number; value: unknown }> = [];
    let preparedSql = "";
    const c = createContext(() => ({
      prepare: async (sql: string) => {
        preparedSql = sql;
        return createMockStatement(
          [
            [11, "123456789", "AAA", "Alpha Asset", "assets"],
            [12, "987654321", "BBB", "Beta Asset", "assets"],
          ],
          binds
        );
      },
    }));

    const result = await fullDumpSearches(c, { cursor: "10", pageSize: 1 });

    expect(preparedSql).toContain("WHERE searches.id > ?");
    expect(preparedSql).toContain("LEFT JOIN cusip_md");
    expect(preparedSql).toContain("LIMIT ?");
    expect(binds).toEqual([
      { index: 1, value: 10 },
      { index: 2, value: 2 },
    ]);
    expect(result).toEqual({
      items: [
        { id: 11, cusip: "123456789", code: "AAA", name: "Alpha Asset", category: "assets" },
      ],
      nextCursor: "11",
    });
  });

  test("search query binds ranking and filter parameters safely", async () => {
    const binds: Array<{ index: number; value: unknown }> = [];
    let preparedSql = "";
    const c = createContext(() => ({
      prepare: async (sql: string) => {
        preparedSql = sql;
        return createMockStatement(
          [[1, "111111111", "ABCD", "Alpha Beta", "assets", 100]],
          binds
        );
      },
    }));

    const result = await searchDuckDb(c, { query: "ABCD", limit: 5 });

    expect(preparedSql).toContain("WITH candidate_ids AS");
    expect(preparedSql).toContain("WHEN LOWER(code) = LOWER(?) THEN 100");
    expect(preparedSql).toContain("cusip_ticker_name");
    expect(preparedSql).toContain("LIMIT ?");
    expect(binds).toEqual([
      { index: 1, value: "ABCD" },
      { index: 2, value: "ABCD%" },
      { index: 3, value: "%ABCD%" },
      { index: 4, value: "%ABCD%" },
      { index: 5, value: "%ABCD%" },
      { index: 6, value: "ABCD%" },
      { index: 7, value: "%ABCD%" },
      { index: 8, value: "ABCD" },
      { index: 9, value: "ABCD%" },
      { index: 10, value: "%ABCD%" },
      { index: 11, value: "ABCD%" },
      { index: 12, value: "%ABCD%" },
      { index: 13, value: "%ABCD%" },
      { index: 14, value: "%ABCD%" },
      { index: 15, value: 5 },
    ]);
    expect(result[0]).toMatchObject({ code: "ABCD", score: 100 });
  });

  test("all assets activity cusip filter uses prepared binding", async () => {
    const binds: Array<{ index: number; value: unknown }> = [];
    let preparedSql = "";
    const c = createContext(() => ({
      prepare: async (sql: string) => {
        preparedSql = sql;
        return createMockStatement(
          [["2024Q1", 1, 2, 3, 4, 5, "123456789", "ABC"]],
          binds
        );
      },
    }));

    const result = await getAllAssetsActivity(c, { cusip: "123456789", ticker: null });

    expect(preparedSql).toContain("WHERE cusip = ?");
    expect(binds).toEqual([{ index: 1, value: "123456789" }]);
    expect(result[0]).toMatchObject({ cusip: "123456789", ticker: "ABC", numOpen: 1 });
  });

  test("investor flow uses prepared ticker binding", async () => {
    const binds: Array<{ index: number; value: unknown }> = [];
    let preparedSql = "";
    const c = createContext(() => ({
      prepare: async (sql: string) => {
        preparedSql = sql;
        return createMockStatement([["2024Q1", 1000, 250]], binds);
      },
    }));

    const result = await getInvestorFlow(c, "MSFT");

    expect(preparedSql).toContain("WHERE ticker = ?");
    expect(binds).toEqual([{ index: 1, value: "MSFT" }]);
    expect(result).toEqual([{ quarter: "2024Q1", inflow: 1000, outflow: 250 }]);
  });

  test("investor drilldown binds optional filters and limit for both action mode", async () => {
    const binds: Array<{ index: number; value: unknown }> = [];
    let preparedSql = "";
    const c = createContext(() => ({
      prepare: async (sql: string) => {
        preparedSql = sql;
        return createMockStatement(
          [["123456789", "2024Q1", 123456n, true, false, false, false, false, "Fund A", "FA", "open"]],
          binds
        );
      },
    }));

    const result = await getInvestorDrilldown(c, {
      ticker: "NVDA",
      cusip: "123456789",
      quarter: "2024Q1",
      action: "both",
      limit: 50,
    });

    expect(preparedSql).toContain("AND (? IS NULL OR d.cusip = ?)");
    expect(preparedSql).toContain("AND (? IS NULL OR d.quarter = ?)");
    expect(preparedSql).toContain("UNION ALL");
    expect(binds).toEqual([
      { index: 1, value: "NVDA" },
      { index: 2, value: "123456789" },
      { index: 3, value: "123456789" },
      { index: 4, value: "2024Q1" },
      { index: 5, value: "2024Q1" },
      { index: 6, value: 50 },
      { index: 7, value: "NVDA" },
      { index: 8, value: "123456789" },
      { index: 9, value: "123456789" },
      { index: 10, value: "2024Q1" },
      { index: 11, value: "2024Q1" },
      { index: 12, value: 50 },
    ]);
    expect(result[0]).toMatchObject({
      cusip: "123456789",
      quarter: "2024Q1",
      cik: "123456",
      action: "open",
      cikName: "Fund A",
      cikTicker: "FA",
      didOpen: true,
      didAdd: false,
      didReduce: false,
      didClose: false,
      didHold: false,
    });
  });

  test("cik quarterly uses prepared CIK binding", async () => {
    const binds: Array<{ index: number; value: unknown }> = [];
    let preparedSql = "";
    const c = createContext(() => ({
      prepare: async (sql: string) => {
        preparedSql = sql;
        return createMockStatement([[898371, "2024Q1", "2024-03-31", 1000, 0.1, 12]], binds);
      },
    }));

    const result = await getCikQuarterly(c, "898371");

    expect(preparedSql).toContain("WHERE cik = ?");
    expect(binds).toEqual([{ index: 1, value: "898371" }]);
    expect(result[0]).toMatchObject({ cik: "898371", quarter: "2024Q1", numAssets: 12 });
  });

  test("assets list uses prepared search/count bindings and returns totals", async () => {
    const countBinds: Array<{ index: number; value: unknown }> = [];
    const listBinds: Array<{ index: number; value: unknown }> = [];
    const preparedSqls: string[] = [];
    const c = createContext(() => ({
      prepare: async (sql: string) => {
        preparedSqls.push(sql);
        if (sql.includes("SELECT COUNT(*)")) {
          return createMockStatement([[2]], countBinds);
        }
        return createMockStatement([["AAPL", "Apple Inc", "037833100"]], listBinds);
      },
    }));

    const result = await listAssets(c, {
      limit: 1,
      offset: 0,
      search: "apple",
      sort: "assetName",
      direction: "asc",
    });

    expect(preparedSqls[0]).toContain("SELECT COUNT(*)");
    expect(preparedSqls[1]).toContain("LIMIT ? OFFSET ?");
    expect(countBinds).toEqual([
      { index: 1, value: "%apple%" },
      { index: 2, value: "%apple%" },
      { index: 3, value: "%apple%" },
    ]);
    expect(listBinds).toEqual([
      { index: 1, value: "%apple%" },
      { index: 2, value: "%apple%" },
      { index: 3, value: "%apple%" },
      { index: 4, value: 1 },
      { index: 5, value: 0 },
    ]);
    expect(result.totalCount).toBe(2);
    expect(result.complete).toBe(false);
    expect(result.rows[0]).toMatchObject({ id: "AAPL-037833100" });
  });

  test("superinvestors list uses prepared limit/offset bindings and returns totals", async () => {
    const binds: Array<{ index: number; value: unknown }> = [];
    const preparedSqls: string[] = [];
    const c = createContext(() => ({
      prepare: async (sql: string) => {
        preparedSqls.push(sql);
        if (sql.includes("SELECT COUNT(*)")) {
          return createMockStatement([[5]], []);
        }
        return createMockStatement([["898371", "Citadel Advisors"]], binds);
      },
    }));

    const result = await listSuperinvestors(c, { limit: 1, offset: 2 });

    expect(preparedSqls[1]).toContain("LIMIT ? OFFSET ?");
    expect(binds).toEqual([
      { index: 1, value: 1 },
      { index: 2, value: 2 },
    ]);
    expect(result.totalCount).toBe(5);
    expect(result.complete).toBe(false);
    expect(result.rows[0]).toMatchObject({ cik: "898371" });
  });

  test("superinvestor asset history uses prepared ticker/cusip/cik bindings", async () => {
    const binds: Array<{ index: number; value: unknown }> = [];
    let preparedSql = "";
    const c = createContext(() => ({
      prepare: async (sql: string) => {
        preparedSql = sql;
        return createMockStatement([["2024Q1", true, "open", 10, 100, 5, 50, 1]], binds);
      },
    }));

    const result = await getSuperinvestorAssetHistory(c, {
      ticker: "AAPL",
      cusip: "037833100",
      cik: "898371",
    });

    expect(preparedSql).toContain("WHERE ticker = ?");
    expect(preparedSql).toContain("AND cusip = ?");
    expect(preparedSql).toContain("CAST(cik AS VARCHAR) = ?");
    expect(binds).toEqual([
      { index: 1, value: "AAPL" },
      { index: 2, value: "037833100" },
      { index: 3, value: "898371" },
    ]);
    expect(result[0]).toMatchObject({ quarter: "2024Q1", reportWindowComplete: true, action: "open" });
  });
});
