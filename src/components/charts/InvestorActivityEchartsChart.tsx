"use client";

import { memo, useMemo } from "react";
import { OpenedClosedBarChart } from "./OpenedClosedBarChart";
import {
  ASSET_DETAIL_CARD_CLASS_NAME,
  ASSET_DETAIL_CARD_CONTENT_CLASS_NAME,
} from "@/components/detail/asset-detail-card-layout";
import type { CusipQuarterInvestorActivity } from "@/schema";

interface InvestorActivityEchartsChartProps {
  data: readonly CusipQuarterInvestorActivity[];
  ticker: string;
  onBarClick?: (selection: { quarter: string; action: "open" | "close" }) => void;
  onBarHover?: (selection: { quarter: string; action: "open" | "close" }) => void;
  onBarLeave?: () => void;
  latencyBadge?: React.ReactNode;
  /** Callback when chart render completes with render time in ms */
  onRenderComplete?: (renderMs: number) => void;
}

/**
 * ECharts chart for per-asset investor activity.
 * Wraps the generic OpenedClosedBarChart with asset-specific data mapping.
 */
export const InvestorActivityEchartsChart = memo(function InvestorActivityEchartsChart({ 
  data, 
  ticker, 
  onBarClick,
  onBarHover,
  onBarLeave,
  latencyBadge,
  onRenderComplete,
}: InvestorActivityEchartsChartProps) {
  // Transform CusipQuarterInvestorActivity to QuarterlyActivityPoint
  const chartData = useMemo(() => {
    return data.map((item) => ({
      quarter: item.quarter ?? "Unknown",
      opened: item.numOpen ?? 0,
      closed: item.numClose ?? 0, // Keep positive, chart handles negation
    }));
  }, [data]);

  return (
    <OpenedClosedBarChart
      data={chartData}
      title={`Investor Activity for ${ticker} (ECharts)`}
      onBarClick={onBarClick}
      onBarHover={onBarHover}
      onBarLeave={onBarLeave}
      onRenderComplete={onRenderComplete}
      latencyBadge={latencyBadge}
      unitLabel="investors"
      cardClassName={ASSET_DETAIL_CARD_CLASS_NAME}
      cardContentClassName={ASSET_DETAIL_CARD_CONTENT_CLASS_NAME}
    />
  );
});
