import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import * as assetActivityModule from "./asset-activity";
import * as investorFlowModule from "./investor-flow";
import * as investorDetailsModule from "./investor-details";
import * as cikQuarterlyModule from "./cik-quarterly";

describe("page cache cleanup", () => {
  afterEach(() => {
    mock.restore();
  });

  test("clears asset detail route collections to avoid unbounded tab memory growth", async () => {
    const clearAssetActivitySpy = spyOn(assetActivityModule, "clearAllAssetActivityData");
    const clearInvestorFlowSpy = spyOn(investorFlowModule, "clearAllInvestorFlowData");
    const clearDrilldownSessionSpy = spyOn(investorDetailsModule, "clearDrilldownSessionState");
    const clearDrilldownPersistedSpy = spyOn(investorDetailsModule, "clearAllDrilldownData");
    const { clearAssetDetailRouteCaches } = await import("./page-cache-cleanup");

    clearAssetDetailRouteCaches();

    expect(clearAssetActivitySpy).toHaveBeenCalledTimes(1);
    expect(clearInvestorFlowSpy).toHaveBeenCalledTimes(1);
    expect(clearDrilldownSessionSpy).toHaveBeenCalledTimes(1);
    expect(clearDrilldownPersistedSpy).not.toHaveBeenCalled();
  });

  test("clears superinvestor detail collections when leaving the route", async () => {
    const clearCikQuarterlySpy = spyOn(cikQuarterlyModule, "clearAllCikQuarterlyData");
    const { clearSuperinvestorDetailRouteCaches } = await import("./page-cache-cleanup");

    clearSuperinvestorDetailRouteCaches();

    expect(clearCikQuarterlySpy).toHaveBeenCalledTimes(1);
  });
});
