import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "@tanstack/react-db";
import { fetchInvestorFlowData, investorFlowCollection } from "@/collections";
import { LatencyBadge, type DataFlow } from "@/components/LatencyBadge";
import { InvestorFlowChart, InvestorFlowUplotChart } from "@/components/charts/InvestorFlowChart";

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
    ? "tsdb-api"
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

export const AssetFlowSection = memo(function AssetFlowSection({ code, ticker }: AssetFlowSectionProps) {
  const [flowStatus, setFlowStatus] = useState<AssetFlowLoadState>(() => createInitialAssetFlowState(code));
  const [flowRenderMs, setFlowRenderMs] = useState<number | null>(null);
  const [flowUplotRenderMs, setFlowUplotRenderMs] = useState<number | null>(null);
  const { data: flowCollectionData } = useLiveQuery((q) => q.from({ rows: investorFlowCollection }));

  const {
    queryTimeMs: flowQueryTimeMs,
    dataSource: flowDataSource,
    isLoading: isFlowLoading,
  } = flowStatus;

  const flowRows = useMemo(() => {
    if (!flowCollectionData || !code) return [];
    const normalizedCode = code.trim().toUpperCase();
    return flowCollectionData
      .filter((row) => row.ticker === normalizedCode)
      .sort((left, right) => left.quarter.localeCompare(right.quarter));
  }, [flowCollectionData, code]);

  const handleFlowRenderComplete = useCallback((renderMs: number) => {
    setFlowRenderMs(renderMs);
  }, []);

  const handleFlowUplotRenderComplete = useCallback((renderMs: number) => {
    setFlowUplotRenderMs(renderMs);
  }, []);

  const flowUplotLatencyBadge = useMemo(() => (
    <LatencyBadge
      dataLoadMs={flowQueryTimeMs ?? undefined}
      renderMs={flowUplotRenderMs ?? undefined}
      source={flowDataSource}
      variant="inline"
    />
  ), [flowDataSource, flowQueryTimeMs, flowUplotRenderMs]);

  const flowLatencyBadge = useMemo(() => (
    <LatencyBadge
      dataLoadMs={flowQueryTimeMs ?? undefined}
      renderMs={flowRenderMs ?? undefined}
      source={flowDataSource}
      variant="inline"
    />
  ), [flowDataSource, flowQueryTimeMs, flowRenderMs]);

  useEffect(() => {
    if (!code) return;

    let cancelled = false;
    void (async () => {
      let nextState: AssetFlowLoadState = {
        queryTimeMs: null,
        dataSource: "unknown",
        isLoading: false,
      };

      try {
        const { queryTimeMs, source } = await fetchInvestorFlowData(code);
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
        setFlowStatus(nextState);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
      {isFlowLoading ? (
        <div className="flex h-[400px] items-center justify-center rounded-lg border bg-card text-muted-foreground xl:col-span-2">
          Loading flow chart...
        </div>
      ) : (
        <>
          <InvestorFlowUplotChart
            data={flowRows}
            ticker={ticker}
            onRenderComplete={handleFlowUplotRenderComplete}
            latencyBadge={flowUplotLatencyBadge}
          />
          <InvestorFlowChart
            data={flowRows}
            ticker={ticker}
            onRenderComplete={handleFlowRenderComplete}
            latencyBadge={flowLatencyBadge}
          />
        </>
      )}
    </div>
  );
});
