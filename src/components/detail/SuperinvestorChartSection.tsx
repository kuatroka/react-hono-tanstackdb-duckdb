import { useEffect, useState } from "react";
import {
  fetchCikQuarterlyData,
  getCikQuarterlyDataFromCache,
  hasFetchedCikData,
  type CikQuarterlyData,
} from "@/collections";
import { clearSuperinvestorDetailRouteCaches } from "@/collections/page-cache-cleanup";
import { type DataFlow } from "@/components/LatencyBadge";
import { CikValueLineChart } from "@/components/charts/CikValueLineChart";
import { Card, CardContent } from "@/components/ui/card";

interface SuperinvestorChartSectionProps {
  cik: string;
  cikName: string;
}

export function SuperinvestorChartSection({ cik, cikName }: SuperinvestorChartSectionProps) {
  const [chartQueryTimeMs, setChartQueryTimeMs] = useState<number | null>(null);
  const [chartDataSource, setChartDataSource] = useState<DataFlow>("unknown");
  const [chartLoading, setChartLoading] = useState(() => (cik ? !hasFetchedCikData(cik) : false));
  const [chartRenderMs, setChartRenderMs] = useState<number | null>(null);
  const [chartData, setChartData] = useState<CikQuarterlyData[]>(() =>
    cik ? (getCikQuarterlyDataFromCache(cik) ?? []) : []
  );

  useEffect(() => {
    if (!cik) return;

    let cancelled = false;
    const cachedRows = getCikQuarterlyDataFromCache(cik) ?? [];
    const hasCachedData = cachedRows.length > 0;
    setChartData(cachedRows);
    setChartQueryTimeMs(null);
    setChartDataSource("unknown");
    setChartRenderMs(null);
    setChartLoading(!hasCachedData);

    fetchCikQuarterlyData(cik)
      .then(({ rows, queryTimeMs: elapsed, source }) => {
        if (cancelled) return;
        setChartData(rows);
        setChartQueryTimeMs(elapsed);
        setChartDataSource(
          source === "api" ? "tsdb-api" : source === "indexeddb" ? "tsdb-indexeddb" : "tsdb-memory",
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
  }, [cik]);

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
      renderMs={chartRenderMs ?? undefined}
      source={chartDataSource}
      onRenderComplete={setChartRenderMs}
    />
  );
}
