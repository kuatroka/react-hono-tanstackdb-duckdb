import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "@tanstack/react-db";
import { fetchInvestorFlowData, investorFlowCollection } from "@/collections";
import { LatencyBadge, type DataFlow } from "@/components/LatencyBadge";
import { InvestorFlowChart, InvestorFlowUplotChart } from "@/components/charts/InvestorFlowChart";

interface AssetFlowSectionProps {
  code: string;
  ticker: string;
}

export function AssetFlowSection({ code, ticker }: AssetFlowSectionProps) {
  const [flowQueryTimeMs, setFlowQueryTimeMs] = useState<number | null>(null);
  const [flowDataSource, setFlowDataSource] = useState<DataFlow>("unknown");
  const [isFlowLoading, setIsFlowLoading] = useState(false);
  const [flowRenderMs, setFlowRenderMs] = useState<number | null>(null);
  const [flowUplotRenderMs, setFlowUplotRenderMs] = useState<number | null>(null);
  const { data: flowCollectionData } = useLiveQuery((q) => q.from({ rows: investorFlowCollection }));

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

  useEffect(() => {
    if (!code) return;

    let cancelled = false;
    setFlowQueryTimeMs(null);
    setFlowDataSource("unknown");
    setFlowRenderMs(null);
    setFlowUplotRenderMs(null);
    setIsFlowLoading(true);

    fetchInvestorFlowData(code)
      .then(({ queryTimeMs, source }) => {
        if (cancelled) return;
        setFlowQueryTimeMs(queryTimeMs);
        setFlowDataSource(
          source === "api" ? "tsdb-api" : source === "indexeddb" ? "tsdb-indexeddb" : "tsdb-memory",
        );
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("[AssetFlowSection] Failed to load investor flow:", error);
        setFlowQueryTimeMs(null);
        setFlowDataSource("unknown");
      })
      .finally(() => {
        if (!cancelled) {
          setIsFlowLoading(false);
        }
      });

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
            latencyBadge={
              <LatencyBadge
                dataLoadMs={flowQueryTimeMs ?? undefined}
                renderMs={flowUplotRenderMs ?? undefined}
                source={flowDataSource}
                variant="inline"
              />
            }
          />
          <InvestorFlowChart
            data={flowRows}
            ticker={ticker}
            onRenderComplete={handleFlowRenderComplete}
            latencyBadge={
              <LatencyBadge
                dataLoadMs={flowQueryTimeMs ?? undefined}
                renderMs={flowRenderMs ?? undefined}
                source={flowDataSource}
                variant="inline"
              />
            }
          />
        </>
      )}
    </div>
  );
}
