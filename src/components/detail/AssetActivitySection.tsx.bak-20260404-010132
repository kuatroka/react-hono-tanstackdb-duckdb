import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "@tanstack/react-db";
import { assetActivityCollection, fetchAssetActivityData } from "@/collections";
import { LatencyBadge, type DataFlow } from "@/components/LatencyBadge";
import { InvestorActivityUplotChart } from "@/components/charts/InvestorActivityUplotChart";
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
    ? "tsdb-api"
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
  const { setSelection, setHoverSelection } = useAssetDrilldownSection();
  const [activityStatus, setActivityStatus] = useState<AssetActivityLoadState>(() => createInitialAssetActivityState(code));
  const [uplotRenderMs, setUplotRenderMs] = useState<number | null>(null);
  const [echartsRenderMs, setEchartsRenderMs] = useState<number | null>(null);
  const { data: activityCollectionData } = useLiveQuery((q) => q.from({ rows: assetActivityCollection }));

  const {
    queryTimeMs: activityQueryTimeMs,
    dataSource: activityDataSource,
    isLoading: isActivityLoading,
  } = activityStatus;

  const activityRows = useMemo(() => {
    if (!activityCollectionData) return [];
    return activityCollectionData
      .filter((row) => (
        hasCusip
          ? row.ticker === code && row.cusip === cusip
          : row.ticker === code
      ))
      .sort((left, right) => left.quarter.localeCompare(right.quarter))
      .map(({ id: _id, ...row }) => ({ ...row }));
  }, [activityCollectionData, code, cusip, hasCusip]);

  const handleActivityRenderComplete = useCallback((renderMs: number) => {
    setUplotRenderMs(renderMs);
  }, []);

  const handleEchartsRenderComplete = useCallback((renderMs: number) => {
    setEchartsRenderMs(renderMs);
  }, []);

  const handleUplotBarClick = useCallback(({ quarter, action }: { quarter: string; action: "open" | "close" }) => {
    setSelection({ quarter, action });
  }, [setSelection]);

  const handleUplotBarHover = useCallback(({ quarter, action }: { quarter: string; action: "open" | "close" }) => {
    setHoverSelection({ quarter, action });
  }, [setHoverSelection]);

  const handleUplotBarLeave = useCallback(() => {
    setHoverSelection(null);
  }, [setHoverSelection]);

  const uplotLatencyBadge = useMemo(() => (
    <LatencyBadge
      dataLoadMs={activityQueryTimeMs ?? undefined}
      renderMs={uplotRenderMs ?? undefined}
      source={activityDataSource}
      variant="inline"
    />
  ), [activityDataSource, activityQueryTimeMs, uplotRenderMs]);

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

      try {
        const { queryTimeMs, source } = await fetchAssetActivityData(code, hasCusip ? cusip : null);
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
        Loading investor activity charts...
      </div>
    );
  }

  if (activityRows.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        No investor activity data available for this asset.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <InvestorActivityUplotChart
        data={activityRows}
        ticker={ticker}
        onBarClick={handleUplotBarClick}
        onBarHover={handleUplotBarHover}
        onBarLeave={handleUplotBarLeave}
        onRenderComplete={handleActivityRenderComplete}
        latencyBadge={uplotLatencyBadge}
      />
      <InvestorActivityEchartsChart
        data={activityRows}
        ticker={ticker}
        onBarClick={handleUplotBarClick}
        onBarHover={handleUplotBarHover}
        onBarLeave={handleUplotBarLeave}
        onRenderComplete={handleEchartsRenderComplete}
        latencyBadge={echartsLatencyBadge}
      />
    </div>
  );
});
