import { useCallback, useEffect, useMemo, useState } from "react";
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

export function AssetActivitySection({ code, ticker, cusip, hasCusip }: AssetActivitySectionProps) {
  const { setSelection, setHoverSelection } = useAssetDrilldownSection();
  const [activityQueryTimeMs, setActivityQueryTimeMs] = useState<number | null>(null);
  const [activityDataSource, setActivityDataSource] = useState<DataFlow>("unknown");
  const [isActivityLoading, setIsActivityLoading] = useState(false);
  const [uplotRenderMs, setUplotRenderMs] = useState<number | null>(null);
  const [echartsRenderMs, setEchartsRenderMs] = useState<number | null>(null);
  const { data: activityCollectionData } = useLiveQuery((q) => q.from({ rows: assetActivityCollection }));

  const activityRows = useMemo(() => {
    if (!activityCollectionData) return [];
    return activityCollectionData
      .filter((row) => (
        hasCusip
          ? row.ticker === code && row.cusip === cusip
          : row.ticker === code
      ))
      .sort((left, right) => left.quarter.localeCompare(right.quarter));
  }, [activityCollectionData, code, cusip, hasCusip]);

  const handleActivityRenderComplete = useCallback((renderMs: number) => {
    setUplotRenderMs(renderMs);
  }, []);

  const handleEchartsRenderComplete = useCallback((renderMs: number) => {
    setEchartsRenderMs(renderMs);
  }, []);

  useEffect(() => {
    if (!code) return;

    let cancelled = false;
    setActivityQueryTimeMs(null);
    setActivityDataSource("unknown");
    setUplotRenderMs(null);
    setEchartsRenderMs(null);
    setIsActivityLoading(true);

    fetchAssetActivityData(code, hasCusip ? cusip : null)
      .then(({ queryTimeMs, source }) => {
        if (cancelled) return;
        setActivityQueryTimeMs(queryTimeMs);
        setActivityDataSource(
          source === "api" ? "tsdb-api" : source === "indexeddb" ? "tsdb-indexeddb" : "tsdb-memory",
        );
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("[AssetActivitySection] Failed to load asset activity:", error);
        setActivityQueryTimeMs(null);
        setActivityDataSource("unknown");
      })
      .finally(() => {
        if (!cancelled) {
          setIsActivityLoading(false);
        }
      });

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
        onBarClick={({ quarter, action }) => setSelection({ quarter, action })}
        onBarHover={({ quarter, action }) => setHoverSelection({ quarter, action })}
        onBarLeave={() => setHoverSelection(null)}
        onRenderComplete={handleActivityRenderComplete}
        latencyBadge={
          <LatencyBadge
            dataLoadMs={activityQueryTimeMs ?? undefined}
            renderMs={uplotRenderMs ?? undefined}
            source={activityDataSource}
            variant="inline"
          />
        }
      />
      <InvestorActivityEchartsChart
        data={activityRows}
        ticker={ticker}
        onBarClick={({ quarter, action }) => setSelection({ quarter, action })}
        onBarHover={({ quarter, action }) => setHoverSelection({ quarter, action })}
        onBarLeave={() => setHoverSelection(null)}
        onRenderComplete={handleEchartsRenderComplete}
        latencyBadge={
          <LatencyBadge
            dataLoadMs={activityQueryTimeMs ?? undefined}
            renderMs={echartsRenderMs ?? undefined}
            source={activityDataSource}
            variant="inline"
          />
        }
      />
    </div>
  );
}
