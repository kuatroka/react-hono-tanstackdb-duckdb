/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import * as queryClientModule from "@/collections/query-client";
import {
  assetActivityCollection,
  clearAllAssetActivityData,
  getAssetActivityFromCollection,
  loadAssetActivityFromIndexedDB,
} from "@/collections/asset-activity";
import {
  clearAllInvestorFlowData,
  getInvestorFlowFromCollection,
  investorFlowCollection,
  loadInvestorFlowFromIndexedDB,
} from "@/collections/investor-flow";
import {
  clearAllDrilldownData,
  investorDrilldownCollection,
  loadDrilldownFromIndexedDB,
} from "@/collections/investor-details";

describe("pre-sync collection hydration", () => {
  beforeEach(() => {
    mock.restore();
    clearAllAssetActivityData();
    clearAllInvestorFlowData();
    clearAllDrilldownData();
  });

  afterEach(() => {
    mock.restore();
  });

  test("asset activity buffers IndexedDB rows before collection readiness without warning", async () => {
    spyOn(assetActivityCollection, "isReady").mockReturnValue(false);
    const writeSpy = spyOn(assetActivityCollection.utils, "writeUpsert");
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
    spyOn(queryClientModule, "loadPersistedAssetActivityData").mockResolvedValue({
      assetKey: "PLTR::69608A108",
      rows: [
        {
          id: "PLTR::69608A108-2024-Q4",
          assetKey: "PLTR::69608A108",
          ticker: "PLTR",
          cusip: "69608A108",
          quarter: "2024-Q4",
          numOpen: 1,
          numAdd: 2,
          numReduce: 3,
          numClose: 4,
          numHold: 5,
          opened: 1,
          closed: 4,
        },
      ],
      metadata: { persistedAt: Date.now() },
    } as any);

    const loaded = await loadAssetActivityFromIndexedDB("PLTR", "69608A108");

    expect(loaded).toBe(true);
    expect(getAssetActivityFromCollection("PLTR", "69608A108")).toHaveLength(1);
    expect(writeSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test("investor flow buffers IndexedDB rows before collection readiness without warning", async () => {
    spyOn(investorFlowCollection, "isReady").mockReturnValue(false);
    const writeSpy = spyOn(investorFlowCollection.utils, "writeUpsert");
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
    spyOn(queryClientModule, "loadPersistedInvestorFlowData").mockResolvedValue({
      ticker: "PLTR",
      rows: [
        {
          id: "PLTR-2024-Q4",
          ticker: "PLTR",
          quarter: "2024-Q4",
          inflow: 10,
          outflow: 4,
        },
      ],
      metadata: { persistedAt: Date.now() },
    } as any);

    const loaded = await loadInvestorFlowFromIndexedDB("PLTR");

    expect(loaded).toBe(true);
    expect(getInvestorFlowFromCollection("PLTR")).toHaveLength(1);
    expect(writeSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test("drilldown load tolerates pre-ready collection state without warning", async () => {
    spyOn(investorDrilldownCollection, "isReady").mockReturnValue(false);
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
    spyOn(queryClientModule, "loadPersistedDrilldownQuarterData").mockResolvedValue({
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
    } as any);

    const loaded = await loadDrilldownFromIndexedDB("PLTR", "69608A108", "2024-Q4");

    expect(typeof loaded).toBe("boolean");
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
