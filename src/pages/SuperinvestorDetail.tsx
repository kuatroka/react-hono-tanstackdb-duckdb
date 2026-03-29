import { useParams, Link } from '@tanstack/react-router';
import { useLiveQuery } from '@tanstack/react-db';
import { useContentReady } from '@/hooks/useContentReady';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LatencyBadge, type DataFlow } from '@/components/LatencyBadge';
import {
  type Superinvestor,
  fetchSuperinvestorRecord,
  cikQuarterlyCollection,
  fetchCikQuarterlyData,
} from '@/collections';
import { CikValueLineChart } from '@/components/charts/CikValueLineChart';
import { clearSuperinvestorDetailRouteCaches } from '@/collections/page-cache-cleanup';

export function SuperinvestorDetailPage() {
  const { cik } = useParams({ strict: false }) as { cik?: string };
  const { onReady } = useContentReady();
  const [queryTimeMs, setQueryTimeMs] = useState<number | null>(null);
  const [recordSource, setRecordSource] = useState<DataFlow>('unknown');
  const [chartQueryTimeMs, setChartQueryTimeMs] = useState<number | null>(null);
  const [chartDataSource, setChartDataSource] = useState<DataFlow>('unknown');
  const [chartLoading, setChartLoading] = useState(false);
  const [chartRenderMs, setChartRenderMs] = useState<number | null>(null);
  const [record, setRecord] = useState<Superinvestor | null | undefined>(undefined);

  const { data: cikQuarterlyData } = useLiveQuery(
    (q) => q.from({ rows: cikQuarterlyCollection }),
  );

  useEffect(() => {
    if (!cik) {
      setRecord(undefined);
      return;
    }

    let cancelled = false;
    const startedAt = performance.now();
    setRecord(undefined);
    setQueryTimeMs(null);
    setRecordSource('unknown');

    fetchSuperinvestorRecord(cik)
      .then((superinvestor) => {
        if (cancelled) return;
        setRecord(superinvestor);
        setQueryTimeMs(Math.round(performance.now() - startedAt));
        setRecordSource(superinvestor ? 'tsdb-api' : 'unknown');
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('[SuperinvestorDetail] Failed to load superinvestor record:', error);
        setRecord(null);
        setQueryTimeMs(null);
        setRecordSource('unknown');
      });

    return () => {
      cancelled = true;
    };
  }, [cik]);

  // Fetch quarterly chart data when CIK is available
  useEffect(() => {
    if (!cik) return;

    setChartRenderMs(null);
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

  useEffect(() => {
    return () => {
      clearSuperinvestorDetailRouteCaches();
    };
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
    if (record !== undefined) {
      readyCalledRef.current = true;
      onReady();
    }
  }, [record, onReady]);

  if (!cik) return <div className="p-6">Missing CIK.</div>;

  if (record === undefined) {
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
            <LatencyBadge latencyMs={queryTimeMs ?? undefined} source={recordSource} />
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
          onRenderComplete={setChartRenderMs}
          latencyBadge={
            <LatencyBadge
              dataLoadMs={chartQueryTimeMs ?? undefined}
              renderMs={chartRenderMs ?? undefined}
              source={chartDataSource}
            />
          }
        />
      )}
    </div>
  );
}
