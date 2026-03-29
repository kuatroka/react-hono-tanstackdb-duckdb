import { clearAllAssetActivityData } from "./asset-activity";
import { clearAllCikQuarterlyData } from "./cik-quarterly";
import { clearAllDrilldownData } from "./investor-details";
import { clearAllInvestorFlowData } from "./investor-flow";

export function clearAssetDetailRouteCaches(): void {
  clearAllAssetActivityData();
  clearAllInvestorFlowData();
  clearAllDrilldownData();
}

export function clearSuperinvestorDetailRouteCaches(): void {
  clearAllCikQuarterlyData();
}
