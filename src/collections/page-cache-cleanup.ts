import { clearAllAssetActivityData } from "./asset-activity";
import { clearAllCikQuarterlyData } from "./cik-quarterly";
import { clearDrilldownSessionState } from "./investor-details";
import { clearAllInvestorFlowData } from "./investor-flow";

export function clearAssetDetailRouteCaches(): void {
  clearAllAssetActivityData();
  clearAllInvestorFlowData();
  clearDrilldownSessionState();
}

export function clearSuperinvestorDetailRouteCaches(): void {
  clearAllCikQuarterlyData();
}
