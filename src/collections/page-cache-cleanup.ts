import { clearAllAssetActivityData } from "./asset-activity";
import { clearAllCikQuarterlyData } from "./cik-quarterly";
import { clearDrilldownSessionState } from "./investor-details";
import { clearAllInvestorFlowData } from "./investor-flow";
import { clearAllSuperinvestorAssetHistoryData } from "./superinvestor-asset-history";

export function clearAssetDetailRouteCaches(): void {
  clearAllAssetActivityData();
  clearAllInvestorFlowData();
  clearAllSuperinvestorAssetHistoryData();
  clearDrilldownSessionState();
}

export function clearSuperinvestorDetailRouteCaches(): void {
  clearAllCikQuarterlyData();
}
