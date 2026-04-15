import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from '@tanstack/react-db';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { VirtualDataTable, type ColumnDef } from '@/components/VirtualDataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LatencyBadge } from '@/components/LatencyBadge';
import { useContentReady } from '@/hooks/useContentReady';
import type { PerfSource, PerfTelemetry } from '@/lib/perf/telemetry';
import {
  assetsCollection,
  getAssetListLoadSource,
  subscribeAssetListLoadSource,
  type Asset,
} from '@/collections';

export function AssetsTablePage() {
  return <AssetsTableSurface />;
}

function AssetsTableSurface() {
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false }) as { page?: string; search?: string };
  const { onReady } = useContentReady();
  const trimmedSearch = (searchParams.search ?? '').trim();
  const [tableTelemetry, setTableTelemetry] = useState<PerfTelemetry | null>(null);
  const [searchTelemetry, setSearchTelemetry] = useState<PerfTelemetry | null>(null);
  const [dataSource, setDataSource] = useState<PerfSource>(() => {
    const source = getAssetListLoadSource();
    return source === 'api' ? 'api-duckdb' : source === 'indexeddb' ? 'tsdb-indexeddb' : 'tsdb-memory';
  });

  const { data: assetsData, isLoading } = useLiveQuery(
    (q) => q.from({ assets: assetsCollection }),
  );

  const readyCalledRef = useRef(false);
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

  const handleSearchChange = (value: string) => {
    navigate({
      to: '/assets',
      search: { search: value.trim() || undefined },
    });
  };

  const columns = useMemo<ColumnDef<Asset>[]>(() => [
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
  ], []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <CardTitle className="text-3xl font-bold tracking-tight">Assets</CardTitle>
          <div className="flex flex-col items-end gap-2">
            {tableTelemetry ? <LatencyBadge telemetry={tableTelemetry} className="min-w-[11rem] justify-end" /> : null}
            {searchTelemetry ? <LatencyBadge telemetry={searchTelemetry} className="min-w-[11rem] justify-end" /> : null}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading…</div>
          ) : (
            <VirtualDataTable
              data={assetsData || []}
              columns={columns}
              defaultSortColumn="assetName"
              gridTemplateColumns="minmax(12rem, 1fr) minmax(20rem, 1.5fr)"
              latencySource="tsdb-memory"
              dataSource={dataSource}
              onReady={onReady}
              onSearchChange={handleSearchChange}
              onSearchTelemetryChange={setSearchTelemetry}
              onTableTelemetryChange={setTableTelemetry}
              searchDebounceMs={150}
              searchPlaceholder="Search assets..."
              searchTelemetryLabel="search"
              searchValue={trimmedSearch}
              tableTelemetryLabel="virtual table"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
