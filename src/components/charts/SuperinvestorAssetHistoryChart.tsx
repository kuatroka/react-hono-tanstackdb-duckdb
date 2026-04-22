import { memo } from "react";
import type { SuperinvestorAssetHistoryRow } from "@/collections/superinvestor-asset-history";

interface SuperinvestorAssetHistoryChartProps {
  data: readonly SuperinvestorAssetHistoryRow[];
}

export const SuperinvestorAssetHistoryChart = memo(function SuperinvestorAssetHistoryChart({
  data,
}: SuperinvestorAssetHistoryChartProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
        No investor history available for this asset.
      </div>
    );
  }

  return null;
});
