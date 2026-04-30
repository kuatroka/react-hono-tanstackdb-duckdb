import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { VirtualDataTable, type ColumnDef } from '@/components/VirtualDataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PerfTelemetryBadgeSlot } from '@/components/PerfTelemetryBadgeSlot';
import { PageLayout } from '@/components/layout/page-layout';
import { useMarkContentReady } from '@/hooks/useContentReady';
import type { PerfSource } from '@/lib/perf/telemetry';
import { createPerfTelemetryStore } from '@/lib/perf/telemetry-store';
import {
  assetsCollection,
  fetchAssetRecord,
  getAssetListLoadSource,
  getLoadedAssetList,
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

const assetsTableUFuzzyRanking = {
  mode: 'ticker-and-name' as const,
  getCode: (row: Asset) => row.asset,
  getName: (row: Asset) => row.assetName,
};

const AssetsTableCard = memo(function AssetsTableCard({
  dataSource,
  rows,
}: {
  dataSource: PerfSource;
  rows: Asset[];
}) {
  const tableTelemetryStore = useMemo(() => createPerfTelemetryStore(), []);

  return (
    <Card>
      <CardHeader className="flex flex-col items-start justify-between gap-4 space-y-0 sm:flex-row">
        <CardTitle className="text-3xl font-bold tracking-tight">Assets</CardTitle>
        <div className="flex min-w-0 w-full flex-col items-start gap-2 sm:w-auto sm:items-end">
          <PerfTelemetryBadgeSlot store={tableTelemetryStore} className="min-w-0 max-w-full justify-end" />
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
          onTableTelemetryChange={tableTelemetryStore.set}
          clientPageSize={100}
          searchDebounceMs={150}
          searchPlaceholder="Search assets..."
          searchStrategy="ufuzzy"
          ufuzzyRanking={assetsTableUFuzzyRanking}
          searchTelemetryLabel="search"
          tableTelemetryLabel="virtual table"
        />
      </CardContent>
    </Card>
  );
});

function AssetsTableSurface() {
  const onReady = useMarkContentReady();
  const [isLoading, setIsLoading] = useState(() => getLoadedAssetList().length === 0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<PerfSource>(() => {
    if (getLoadedAssetList().length > 0) {
      return 'tsdb-memory';
    }

    const source = getAssetListLoadSource();
    return source === 'api'
      ? 'api-duckdb'
      : source === 'indexeddb'
        ? 'tsdb-indexeddb'
        : 'tsdb-memory';
  });

  const readyCalledRef = useRef(false);
  useEffect(() => {
    if (getLoadedAssetList().length > 0) {
      setDataSource('tsdb-memory');
      setLoadError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        await assetsCollection.preload();
        if (cancelled) return;
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

  const rows = getLoadedAssetList();

  useEffect(() => {
    if (readyCalledRef.current) return;
    if (!isLoading) {
      readyCalledRef.current = true;
      onReady();
    }
  }, [isLoading, onReady]);

  return (
    <PageLayout width="wide">
      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">Loading…</div>
      ) : loadError ? (
        <div className="py-8 text-center text-destructive">{loadError}</div>
      ) : (
        <AssetsTableCard
          dataSource={dataSource}
          rows={rows}
        />
      )}
    </PageLayout>
  );
}
