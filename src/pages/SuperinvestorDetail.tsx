import { useParams, Link } from '@tanstack/react-router';
import { useLiveQuery } from '@tanstack/react-db';
import { useContentReady } from '@/hooks/useContentReady';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LatencyBadge, type DataFlow } from '@/components/LatencyBadge';
import {
  superinvestorsCollection,
  cikQuarterlyCollection,
  fetchCikQuarterlyData,
} from '@/collections';
import { CikValueLineChart } from '@/components/charts/CikValueLineChart';

export function SuperinvestorDetailPage() {
  const { cik } = useParams({ strict: false }) as { cik?: string };
  const { onReady } = useContentReady();
  const [queryTimeMs, setQueryTimeMs] = useState<number | null>(null);
  const [chartQueryTimeMs, setChartQueryTimeMs] = useState<number | null>(null);
  const [chartDataSource, setChartDataSource] = useState<DataFlow>('unknown');
  const [chartLoading, setChartLoading] = useState(false);

  // Query superinvestors from TanStack DB local collection (instant from IndexedDB cache)
  // Data is preloaded on app init and persisted to IndexedDB
  const { data: superinvestorsData, isLoading } = useLiveQuery(
    (q) => q.from({ superinvestors: superinvestorsCollection }),
  );
  const { data: cikQuarterlyData } = useLiveQuery(
    (q) => q.from({ rows: cikQuarterlyCollection }),
  );

  // Find the specific superinvestor record
  const record = superinvestorsData?.find(s => s.cik === cik);

  // Set latency to 0ms when data is available (memory/IndexedDB load)
  useEffect(() => {
    if (!isLoading && superinvestorsData && queryTimeMs == null) {
      setQueryTimeMs(0);
    }
  }, [isLoading, superinvestorsData, queryTimeMs]);

  // Fetch quarterly chart data when CIK is available
  useEffect(() => {
    if (!cik) return;

    setChartLoading(true);

    fetchCikQuarterlyData(cik)
      .then(({ queryTimeMs: elapsed, source }) => {
        setChartQueryTimeMs(elapsed);
        // Map source to DataFlow type for latency badge
        const dataFlow: DataFlow = source === 'api' ? 'tsdb-api'
          : source === 'indexeddb' ? 'tsdb-indexeddb'
          : 'tsdb-memory';
        setChartDataSource(dataFlow);
      })
      .catch((err) => {
        console.error('[SuperinvestorDetail] Failed to fetch quarterly data:', err);
        setChartQueryTimeMs(null);
        setChartDataSource('unknown');
      })
      .finally(() => {
        setChartLoading(false);
      });
  }, [cik]);

  const chartData = useMemo(() => {
    if (!cikQuarterlyData || !cik) return [];
    return cikQuarterlyData
      .filter((row) => row.cik === cik)
      .sort((left, right) => left.quarter.localeCompare(right.quarter));
  }, [cikQuarterlyData, cik]);

  // Signal ready when data is available (from cache or server)
  const readyCalledRef = useRef(false);
  useEffect(() => {
    if (readyCalledRef.current) return;
    if (record || (!isLoading && superinvestorsData !== undefined)) {
      readyCalledRef.current = true;
      onReady();
    }
  }, [record, isLoading, superinvestorsData, onReady]);

  if (!cik) return <div className="p-6">Missing CIK.</div>;

  // Show loading while data is loading OR while we have no data yet
  // (Dexie collections may return empty array initially before IndexedDB loads)
  if (isLoading || (superinvestorsData?.length === 0)) {
    return <div className="p-6">Loading…</div>;
  }

  if (!record) {
    return <div className="p-6">Superinvestor not found.</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span>{record.cikName}</span>
            <LatencyBadge latencyMs={queryTimeMs ?? undefined} source="tsdb-indexeddb" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-lg">
            <div><span className="font-semibold">CIK:</span> {record.cik}</div>
          </div>
          <div className="mt-6">
            <Link to="/superinvestors" search={{ page: undefined, search: undefined }} className="link link-primary">Back to superinvestors</Link>
          </div>
        </CardContent>
      </Card>

      {/* Portfolio Value Chart */}
      {chartLoading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Loading portfolio history...
          </CardContent>
        </Card>
      ) : (
        <CikValueLineChart
          data={chartData}
          cikName={record.cikName}
          latencyBadge={
            <LatencyBadge
              latencyMs={chartQueryTimeMs ?? undefined}
              source={chartDataSource}
            />
          }
        />
      )}
    </div>
  );
}
