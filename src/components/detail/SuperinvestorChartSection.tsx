import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchCikQuarterlyData,
  getCikQuarterlyDataFromCache,
  hasFetchedCikData,
  type CikQuarterlyData,
} from "@/collections";
import { clearSuperinvestorDetailRouteCaches } from "@/collections/page-cache-cleanup";
import { type DataFlow } from "@/components/LatencyBadge";
import { CikValueLineChart } from "@/components/charts/CikValueLineChart";
import { RenderLatencyBadgeSlot } from "@/components/RenderLatencyBadgeSlot";
import { Card, CardContent } from "@/components/ui/card";
import { createNumberMetricStore } from "@/lib/perf/metric-store";

interface SuperinvestorChartSectionProps {
  cik: string;
  cikName: string;
}

export function SuperinvestorChartSection({ cik, cikName }: SuperinvestorChartSectionProps) {
  const [chartQueryTimeMs, setChartQueryTimeMs] = useState<number | null>(null);
  const [chartDataSource, setChartDataSource] = useState<DataFlow>("unknown");
  const [chartLoading, setChartLoading] = useState(() => (cik ? !hasFetchedCikData(cik) : false));
  const [chartData, setChartData] = useState<CikQuarterlyData[]>(() =>
    cik ? (getCikQuarterlyDataFromCache(cik) ?? []) : []
  );
  const renderMsStore = useMemo(() => createNumberMetricStore(), []);
  const handleChartRenderComplete = useCallback((renderMs: number) => {
    renderMsStore.set(renderMs);
  }, [renderMsStore]);
  const chartLatencyBadge = useMemo(() => (
    <RenderLatencyBadgeSlot
      dataLoadMs={chartQueryTimeMs ?? undefined}
      renderMsStore={renderMsStore}
      source={chartDataSource}
    />
  ), [chartDataSource, chartQueryTimeMs, renderMsStore]);

  useEffect(() => {
    if (!cik) return;

    let cancelled = false;
    const cachedRows = getCikQuarterlyDataFromCache(cik) ?? [];
    const hasCachedData = cachedRows.length > 0;
    setChartData(cachedRows);
    setChartQueryTimeMs(null);
    setChartDataSource("unknown");
    renderMsStore.set(null);
    setChartLoading(!hasCachedData);

    fetchCikQuarterlyData(cik)
      .then(({ rows, queryTimeMs: elapsed, source }) => {
        if (cancelled) return;
        setChartData(rows);
        setChartQueryTimeMs(elapsed);
        setChartDataSource(
          source === "api" ? "api-duckdb" : source === "indexeddb" ? "tsdb-indexeddb" : "tsdb-memory",
        );
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("[SuperinvestorChartSection] Failed to fetch quarterly data:", error);
        setChartQueryTimeMs(null);
        setChartDataSource("unknown");
      })
      .finally(() => {
        if (!cancelled) {
          setChartLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cik, renderMsStore]);

  useEffect(() => {
    return () => {
      clearSuperinvestorDetailRouteCaches();
    };
  }, [cik]);

  if (chartLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading portfolio history...
        </CardContent>
      </Card>
    );
  }

  return (
    <CikValueLineChart
      data={chartData}
      cikName={cikName}
      dataLoadMs={chartQueryTimeMs ?? undefined}
      source={chartDataSource}
      onRenderComplete={handleChartRenderComplete}
      latencyBadge={chartLatencyBadge}
    />
  );
}
