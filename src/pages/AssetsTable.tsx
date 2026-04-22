import { memo, useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { VirtualDataTable, type ColumnDef } from '@/components/VirtualDataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LatencyBadge } from '@/components/LatencyBadge';
import { PageLayout } from '@/components/layout/page-layout';
import { useMarkContentReady } from '@/hooks/useContentReady';
import type { PerfSource, PerfTelemetry } from '@/lib/perf/telemetry';
import {
  assetsCollection,
  fetchAssetRecord,
  getAssetListLoadSource,
  subscribeAssetListLoadSource,
  type Asset,
} from '@/collections';

export function AssetsTablePage() {
  return <AssetsTableSurface />;
}

const DEFAULT_SORT_COLUMN: AssetSortColumn = 'assetName';
const DEFAULT_SORT_DIRECTION: SortDirection = 'asc';
type SortDirection = 'asc' | 'desc';
type AssetSortColumn = Extract<keyof Asset, string>;

const assetsTableColumns: ColumnDef<Asset>[] = [
  {
    key: 'asset',
    header: 'Asset',
    sortable: true,
    searchable: true,
    clickable: true,
    render: (value, row, isFocused) => {
      return (
        <Link
          to="/assets/$code/$cusip"
          params={{ code: row.asset, cusip: row.cusip ?? '_' }}
          className={`hover:underline underline-offset-4 cursor-pointer text-foreground outline-none ${isFocused ? 'underline' : ''}`}
          onMouseEnter={() => { void fetchAssetRecord(row.asset, row.cusip); }}
          onFocus={() => { void fetchAssetRecord(row.asset, row.cusip); }}
        >
          {String(value)}
        </Link>
      );
    },
  },
  {
    key: 'assetName',
    header: 'Asset Name',
    sortable: true,
    searchable: true,
  },
];

const AssetsTableCard = memo(function AssetsTableCard({
  dataSource,
  rows,
}: {
  dataSource: PerfSource;
  rows: Asset[];
}) {
  const [tableTelemetry, setTableTelemetry] = useState<PerfTelemetry | null>(null);

  return (
    <Card>
      <CardHeader className="flex flex-col items-start justify-between gap-4 space-y-0 sm:flex-row">
        <CardTitle className="text-3xl font-bold tracking-tight">Assets</CardTitle>
        <div className="flex min-w-0 w-full flex-col items-start gap-2 sm:w-auto sm:items-end">
          {tableTelemetry ? <LatencyBadge telemetry={tableTelemetry} className="min-w-0 max-w-full justify-end" /> : null}
        </div>
      </CardHeader>
      <CardContent>
        <VirtualDataTable
          data={rows}
          columns={assetsTableColumns}
          defaultSortColumn={DEFAULT_SORT_COLUMN}
          defaultSortDirection={DEFAULT_SORT_DIRECTION}
          gridTemplateColumns="minmax(11rem, 0.9fr) minmax(15rem, 1.3fr)"
          mobileGridTemplateColumns="minmax(9rem, 1fr) minmax(11rem, 1.1fr)"
          latencySource="tsdb-memory"
          dataSource={dataSource}
          onTableTelemetryChange={setTableTelemetry}
          clientPageSize={100}
          searchDebounceMs={150}
          searchPlaceholder="Search assets..."
          searchStrategy="ufuzzy"
          ufuzzyRanking={{
            mode: 'ticker-and-name',
            getCode: (row) => row.asset,
            getName: (row) => row.assetName,
          }}
          searchTelemetryLabel="search"
          tableTelemetryLabel="virtual table"
        />
      </CardContent>
    </Card>
  );
});

function AssetsTableSurface() {
  const onReady = useMarkContentReady();
  const [assetsData, setAssetsData] = useState<Asset[] | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<PerfSource>(() => {
    const source = getAssetListLoadSource();
    return source === 'api'
      ? 'api-duckdb'
      : source === 'indexeddb'
        ? 'tsdb-indexeddb'
        : 'tsdb-memory';
  });

  const readyCalledRef = useRef(false);
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        await assetsCollection.preload();
        if (cancelled) return;
        setAssetsData(Array.from(assetsCollection.entries()).map(([, value]) => value));
        setLoadError(null);
      } catch (error) {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : 'Failed to load assets.');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const toPerfSource = (source: 'memory' | 'indexeddb' | 'api'): PerfSource => {
      if (source === 'api') return 'api-duckdb';
      if (source === 'indexeddb') return 'tsdb-indexeddb';
      return 'tsdb-memory';
    };

    setDataSource(toPerfSource(getAssetListLoadSource()));
    return subscribeAssetListLoadSource((source) => {
      setDataSource(toPerfSource(source));
    });
  }, []);

  useEffect(() => {
    if (readyCalledRef.current) return;
    if (assetsData !== undefined) {
      readyCalledRef.current = true;
      onReady();
    }
  }, [assetsData, onReady]);

  return (
    <PageLayout width="wide">
      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">Loading…</div>
      ) : loadError ? (
        <div className="py-8 text-center text-destructive">{loadError}</div>
      ) : (
        <AssetsTableCard
          dataSource={dataSource}
          rows={assetsData || []}
        />
      )}
    </PageLayout>
  );
}
