import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";

type PersistedDrilldownData = {
  key: string;
  scope: "quarter" | "pair";
  pairKey: string;
  quarter: string | null;
  rows: Array<{
    id: string;
    ticker: string;
    cik: string;
    cikName: string;
    cikTicker: string;
    quarter: string;
    cusip: string | null;
    action: "open" | "close";
    didOpen: boolean | null;
    didAdd: boolean | null;
    didReduce: boolean | null;
    didClose: boolean | null;
    didHold: boolean | null;
  }>;
  complete: boolean;
  metadata?: {
    persistedAt?: number;
    lastAccessedAt?: number;
    dataVersion?: string | null;
  };
};

let loadQuarterCalls: Array<[string, string]> = [];
let loadPairCalls: string[] = [];
let persistQuarterCalls: Array<[string, string, PersistedDrilldownData["rows"], boolean]> = [];
let persistPairCalls: Array<[string, PersistedDrilldownData["rows"], boolean]> = [];
let loadQuarterImpl: (pairKey: string, quarter: string) => Promise<PersistedDrilldownData | null> = async () => null;
let loadPairImpl: (pairKey: string) => Promise<PersistedDrilldownData | null> = async () => null;

describe("investor drilldown persistence", () => {
  beforeEach(() => {
    mock.restore();
    loadQuarterCalls = [];
    loadPairCalls = [];
    persistQuarterCalls = [];
    persistPairCalls = [];
    loadQuarterImpl = async () => null;
    loadPairImpl = async () => null;
  });

  afterEach(() => {
    spyOn(globalThis, "fetch").mockRestore?.();
    mock.restore();
  });

  async function importFreshInvestorDetailsModule() {
    const investorDetailsModule = await import(`${new URL("./investor-details.ts", import.meta.url).href}?t=${Date.now()}-${Math.random()}`);
    investorDetailsModule.__setDrilldownPersistenceForTest({
      clearPersistedDrilldownData: async () => undefined,
      loadPersistedDrilldownQuarterData: async (pairKey: string, quarter: string) => {
        loadQuarterCalls.push([pairKey, quarter]);
        return loadQuarterImpl(pairKey, quarter);
      },
      loadPersistedDrilldownPairData: async (pairKey: string) => {
        loadPairCalls.push(pairKey);
        return loadPairImpl(pairKey);
      },
      persistDrilldownPairData: async (
        pairKey: string,
        rows: PersistedDrilldownData["rows"],
        complete: boolean,
      ) => {
        persistPairCalls.push([pairKey, rows, complete]);
      },
      persistDrilldownQuarterData: async (
        pairKey: string,
        quarter: string,
        rows: PersistedDrilldownData["rows"],
        complete: boolean,
      ) => {
        persistQuarterCalls.push([pairKey, quarter, rows, complete]);
      },
    });
    return investorDetailsModule;
  }

  test("does not treat incomplete persisted quarter scopes as complete cache hits", async () => {
    loadQuarterImpl = async () => ({
      key: "quarter:PLTR::69608A108:2024-Q4",
      scope: "quarter",
      pairKey: "PLTR::69608A108",
      quarter: "2024-Q4",
      rows: [
        {
          id: "69608A108-2024-Q4-open-1234",
          ticker: "PLTR",
          cik: "1234",
          cikName: "Example Capital",
          cikTicker: "EXMP",
          quarter: "2024-Q4",
          cusip: "69608A108",
          action: "open",
          didOpen: true,
          didAdd: false,
          didReduce: false,
          didClose: false,
          didHold: false,
        },
      ],
      complete: false,
      metadata: { persistedAt: Date.now() },
    });

    const investorDetailsModule = await importFreshInvestorDetailsModule();
    investorDetailsModule.clearAllDrilldownData();

    const loaded = await investorDetailsModule.loadDrilldownFromIndexedDB("PLTR", "69608A108", "2024-Q4");

    expect(loaded).toBe(true);
    expect(loadQuarterCalls).toEqual([["PLTR::69608A108", "2024-Q4"]]);
    expect(loadPairCalls).toEqual(["PLTR::69608A108"]);
    expect(investorDetailsModule.hasFetchedDrilldownData("PLTR", "69608A108", "2024-Q4", "open")).toBe(false);
    expect(investorDetailsModule.getDrilldownDataFromCollection("PLTR", "69608A108", "2024-Q4", "open")).toBeNull();
  });

  test("restores complete pair scopes without loading one global drilldown blob", async () => {
    loadPairImpl = async () => ({
      key: "pair:PLTR::69608A108",
      scope: "pair",
      pairKey: "PLTR::69608A108",
      quarter: null,
      rows: [
        {
          id: "69608A108-2024-Q4-open-1234",
          ticker: "PLTR",
          cik: "1234",
          cikName: "Example Capital",
          cikTicker: "EXMP",
          quarter: "2024-Q4",
          cusip: "69608A108",
          action: "open",
          didOpen: true,
          didAdd: false,
          didReduce: false,
          didClose: false,
          didHold: false,
        },
      ],
      complete: true,
      metadata: { persistedAt: Date.now() },
    });

    const investorDetailsModule = await importFreshInvestorDetailsModule();
    investorDetailsModule.clearAllDrilldownData();

    const loaded = await investorDetailsModule.loadDrilldownFromIndexedDB("PLTR", "69608A108");

    expect(loaded).toBe(true);
    expect(loadQuarterCalls).toEqual([]);
    expect(loadPairCalls).toEqual(["PLTR::69608A108"]);
    expect(investorDetailsModule.hasFetchedDrilldownData("PLTR", "69608A108", "2024-Q4", "open")).toBe(true);
  });

  test("marks complete quarter fetches as fetched and persists scoped data", async () => {
    const investorDetailsModule = await importFreshInvestorDetailsModule();
    investorDetailsModule.clearAllDrilldownData();

    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          rows: [
            {
              action: "open",
              cik: "1234",
              cikName: "Example Capital",
              cikTicker: "EXMP",
              quarter: "2024-Q4",
              cusip: "69608A108",
              didOpen: true,
              didAdd: false,
              didReduce: false,
              didClose: false,
              didHold: false,
            },
            {
              action: "close",
              cik: "9999",
              cikName: "Other Capital",
              cikTicker: "OTHR",
              quarter: "2024-Q4",
              cusip: "69608A108",
              didOpen: false,
              didAdd: false,
              didReduce: false,
              didClose: true,
              didHold: false,
            },
          ],
          complete: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await investorDetailsModule.fetchDrilldownBothActions("PLTR", "69608A108", "2024-Q4");

    expect(loadQuarterCalls).toEqual([["PLTR::69608A108", "2024-Q4"]]);
    expect(loadPairCalls).toEqual(["PLTR::69608A108"]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.complete).toBe(true);
    expect(result.rows).toHaveLength(2);
    expect(investorDetailsModule.hasFetchedDrilldownData("PLTR", "69608A108", "2024-Q4", "open")).toBe(true);
    expect(investorDetailsModule.hasFetchedDrilldownData("PLTR", "69608A108", "2024-Q4", "close")).toBe(true);
    expect(investorDetailsModule.getDrilldownDataFromCollection("PLTR", "69608A108", "2024-Q4", "open")).toEqual([
      expect.objectContaining({ cik: "1234", action: "open" }),
    ]);
    expect(persistQuarterCalls).toEqual([
      [
        "PLTR::69608A108",
        "2024-Q4",
        expect.arrayContaining([
          expect.objectContaining({ cik: "1234", action: "open" }),
          expect.objectContaining({ cik: "9999", action: "close" }),
        ]),
        true,
      ],
    ]);
  });

  test("persists bulk fetches by pair scope instead of merging into a global blob", async () => {
    const investorDetailsModule = await importFreshInvestorDetailsModule();
    investorDetailsModule.clearAllDrilldownData();

    spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          rows: [
            {
              action: "open",
              cik: "1234",
              cikName: "Example Capital",
              cikTicker: "EXMP",
              quarter: "2024-Q4",
              cusip: "69608A108",
              didOpen: true,
              didAdd: false,
              didReduce: false,
              didClose: false,
              didHold: false,
            },
          ],
          complete: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await investorDetailsModule.backgroundLoadAllDrilldownData("PLTR", "69608A108", []);

    expect(persistPairCalls).toEqual([
      [
        "PLTR::69608A108",
        expect.arrayContaining([
          expect.objectContaining({ cik: "1234", action: "open" }),
        ]),
        true,
      ],
    ]);
  });
});
