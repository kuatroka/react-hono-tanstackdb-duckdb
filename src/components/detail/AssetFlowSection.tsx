import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchInvestorFlowData,
  getInvestorFlowFromCollection,
  type InvestorFlowData,
} from "@/collections/investor-flow";
import { type DataFlow } from "@/components/LatencyBadge";
import { InvestorFlowChart } from "@/components/charts/InvestorFlowChart";
import { RenderLatencyBadgeSlot } from "@/components/RenderLatencyBadgeSlot";
import { createNumberMetricStore } from "@/lib/perf/metric-store";

interface AssetFlowSectionProps {
  code: string;
  ticker: string;
}

interface AssetFlowLoadState {
  queryTimeMs: number | null;
  dataSource: DataFlow;
  isLoading: boolean;
}

function mapAssetFlowDataSource(source: string): DataFlow {
  return source === "api"
    ? "api-duckdb"
    : source === "indexeddb"
      ? "tsdb-indexeddb"
      : "tsdb-memory";
}

function createInitialAssetFlowState(code: string): AssetFlowLoadState {
  return {
    queryTimeMs: null,
    dataSource: "unknown",
    isLoading: Boolean(code),
  };
}

export const AssetFlowSection = memo(function AssetFlowSection({
  code,
  ticker,
}: AssetFlowSectionProps) {
  const [flowStatus, setFlowStatus] = useState<AssetFlowLoadState>(() => createInitialAssetFlowState(code));
  const [flowRows, setFlowRows] = useState<InvestorFlowData[]>([]);
  const renderMsStore = useMemo(() => createNumberMetricStore(), []);
  const handleFlowRenderComplete = useCallback((renderMs: number) => {
    renderMsStore.set(renderMs);
  }, [renderMsStore]);

  const {
    queryTimeMs: flowQueryTimeMs,
    dataSource: flowDataSource,
    isLoading: isFlowLoading,
  } = flowStatus;

  const flowLatencyBadge = useMemo(() => (
    <RenderLatencyBadgeSlot
      dataLoadMs={flowQueryTimeMs ?? undefined}
      renderMsStore={renderMsStore}
      source={flowDataSource}
    />
  ), [flowDataSource, flowQueryTimeMs, renderMsStore]);

  useEffect(() => {
    if (!code) return;

    let cancelled = false;
    void (async () => {
      let nextState: AssetFlowLoadState = {
        queryTimeMs: null,
        dataSource: "unknown",
        isLoading: false,
      };

      let nextRows: InvestorFlowData[] = [];

      try {
        const { rows, queryTimeMs, source } = await fetchInvestorFlowData(code);
        nextRows = rows.length > 0 ? rows : getInvestorFlowFromCollection(code);
        nextRows = [...nextRows].sort((left, right) => left.quarter.localeCompare(right.quarter));
        nextState = {
          queryTimeMs,
          dataSource: mapAssetFlowDataSource(source),
          isLoading: false,
        };
      } catch (error) {
        if (!cancelled) {
          console.error("[AssetFlowSection] Failed to load investor flow:", error);
        }
      }

      if (!cancelled) {
        renderMsStore.set(null);
        setFlowRows(nextRows);
        setFlowStatus(nextState);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, renderMsStore]);

  if (isFlowLoading) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Loading investor flow chart...
      </div>
    );
  }

  return (
    <InvestorFlowChart
      data={flowRows}
      ticker={ticker}
      onRenderComplete={handleFlowRenderComplete}
      latencyBadge={flowLatencyBadge}
    />
  );
});
