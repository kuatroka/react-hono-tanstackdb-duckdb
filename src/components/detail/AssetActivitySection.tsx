import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchAssetActivityData,
  getAssetActivityFromCollection,
  type AssetActivityData,
} from "@/collections/asset-activity";
import { LatencyBadge, type DataFlow } from "@/components/LatencyBadge";
import { InvestorActivityEchartsChart } from "@/components/charts/InvestorActivityEchartsChart";
import { useAssetDrilldownSection } from "@/components/detail/AssetDrilldownSection";

interface AssetActivitySectionProps {
  code: string;
  ticker: string;
  cusip: string | null;
  hasCusip: boolean;
}

interface AssetActivityLoadState {
  queryTimeMs: number | null;
  dataSource: DataFlow;
  isLoading: boolean;
}

function mapAssetActivityDataSource(source: string): DataFlow {
  return source === "api"
    ? "api-duckdb"
    : source === "indexeddb"
      ? "tsdb-indexeddb"
      : "tsdb-memory";
}

function createInitialAssetActivityState(code: string): AssetActivityLoadState {
  return {
    queryTimeMs: null,
    dataSource: "unknown",
    isLoading: Boolean(code),
  };
}

export const AssetActivitySection = memo(function AssetActivitySection({
  code,
  ticker,
  cusip,
  hasCusip,
}: AssetActivitySectionProps) {
  const { setSelection } = useAssetDrilldownSection();
  const [activityStatus, setActivityStatus] = useState<AssetActivityLoadState>(() => createInitialAssetActivityState(code));
  const [activityRows, setActivityRows] = useState<AssetActivityData[]>([]);
  const [echartsRenderMs, setEchartsRenderMs] = useState<number | null>(null);

  const {
    queryTimeMs: activityQueryTimeMs,
    dataSource: activityDataSource,
    isLoading: isActivityLoading,
  } = activityStatus;

  const handleActivityRenderComplete = useCallback((renderMs: number) => {
    setEchartsRenderMs(renderMs);
  }, []);

  const handleActivityBarClick = useCallback(({ quarter, action }: { quarter: string; action: "open" | "close" }) => {
    setSelection({ quarter, action });
  }, [setSelection]);

  const echartsLatencyBadge = useMemo(() => (
    <LatencyBadge
      dataLoadMs={activityQueryTimeMs ?? undefined}
      renderMs={echartsRenderMs ?? undefined}
      source={activityDataSource}
      variant="inline"
    />
  ), [activityDataSource, activityQueryTimeMs, echartsRenderMs]);

  useEffect(() => {
    if (!code) return;

    let cancelled = false;
    void (async () => {
      let nextState: AssetActivityLoadState = {
        queryTimeMs: null,
        dataSource: "unknown",
        isLoading: false,
      };

      let nextRows: AssetActivityData[] = [];

      try {
        const { rows, queryTimeMs, source } = await fetchAssetActivityData(code, hasCusip ? cusip : null);
        nextRows = rows.length > 0
          ? rows
          : getAssetActivityFromCollection(code, hasCusip ? cusip : null);
        nextRows = [...nextRows].sort((left, right) => left.quarter.localeCompare(right.quarter));
        nextState = {
          queryTimeMs,
          dataSource: mapAssetActivityDataSource(source),
          isLoading: false,
        };
      } catch (error) {
        if (!cancelled) {
          console.error("[AssetActivitySection] Failed to load asset activity:", error);
        }
      }

      if (!cancelled) {
        setActivityRows(nextRows);
        setActivityStatus(nextState);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, cusip, hasCusip]);

  if (isActivityLoading) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Loading investor activity chart...
      </div>
    );
  }

  return (
    <InvestorActivityEchartsChart
      data={activityRows}
      ticker={ticker}
      onBarClick={handleActivityBarClick}
      onRenderComplete={handleActivityRenderComplete}
      latencyBadge={echartsLatencyBadge}
    />
  );
});
