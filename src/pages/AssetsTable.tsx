import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { VirtualDataTable, type ColumnDef } from '@/components/VirtualDataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LatencyBadge } from '@/components/LatencyBadge';
import { useContentReady } from '@/hooks/useContentReady';
import type { PerfSource, PerfTelemetry } from '@/lib/perf/telemetry';
import { fetchAssetRecord, type Asset } from '@/collections';

export function AssetsTablePage() {
  return <AssetsTableSurface />;
}

type SortDirection = 'asc' | 'desc';
type AssetSortColumn = Extract<keyof Asset, string>;

interface AssetListPage {
  rows: Asset[];
  nextOffset: number | null;
  source: PerfSource;
}

const PAGE_SIZE = 100;
const DEFAULT_SORT_COLUMN: AssetSortColumn = 'assetName';
const DEFAULT_SORT_DIRECTION: SortDirection = 'asc';

function buildAssetListUrl({
  offset,
  search,
  sortColumn,
  sortDirection,
}: {
  offset: number;
  search: string;
  sortColumn: AssetSortColumn;
  sortDirection: SortDirection;
}) {
  const params = new URLSearchParams();
  params.set('limit', String(PAGE_SIZE));
  params.set('offset', String(offset));
  params.set('sort', sortColumn);
  params.set('direction', sortDirection);
  if (search) {
    params.set('search', search);
  }
  return `/api/assets?${params.toString()}`;
}

async function fetchAssetPage({
  offset,
  search,
  sortColumn,
  sortDirection,
}: {
  offset: number;
  search: string;
  sortColumn: AssetSortColumn;
  sortDirection: SortDirection;
}): Promise<AssetListPage> {
  const response = await fetch(buildAssetListUrl({ offset, search, sortColumn, sortDirection }));
  if (!response.ok) {
    throw new Error('Failed to fetch assets');
  }
  return await response.json() as AssetListPage;
}

function AssetsTableSurface() {
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false }) as { page?: string; search?: string };
  const { onReady } = useContentReady();
  const trimmedSearch = (searchParams.search ?? '').trim();
  const [tableTelemetry, setTableTelemetry] = useState<PerfTelemetry | null>(null);
  const [sortColumn, setSortColumn] = useState<AssetSortColumn>(DEFAULT_SORT_COLUMN);
  const [sortDirection, setSortDirection] = useState<SortDirection>(DEFAULT_SORT_DIRECTION);

  const assetsQuery = useInfiniteQuery({
    queryKey: ['assets', trimmedSearch, sortColumn, sortDirection],
    queryFn: async ({ pageParam = 0 }) => await fetchAssetPage({
      offset: Number(pageParam),
      search: trimmedSearch,
      sortColumn,
      sortDirection,
    }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset ?? undefined,
  });

  const assetsData = useMemo(
    () => assetsQuery.data?.pages.flatMap((page) => page.rows) ?? [],
    [assetsQuery.data],
  );

  const dataSource: PerfSource = assetsQuery.data?.pages[0]?.source ?? 'api-duckdb';

  const readyCalledRef = useRef(false);
  useEffect(() => {
    if (readyCalledRef.current) return;
    if (assetsQuery.status !== 'pending') {
      readyCalledRef.current = true;
      onReady();
    }
  }, [assetsQuery.status, onReady]);

  const handleSearchChange = (value: string) => {
    navigate({
      to: '/assets',
      search: { search: value.trim() || undefined },
      resetScroll: false,
    });
  };

  const handleSortChange = (column: AssetSortColumn, direction: SortDirection) => {
    setSortColumn(column);
    setSortDirection(direction);
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
  ], []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <CardTitle className="text-3xl font-bold tracking-tight">Assets</CardTitle>
          <div className="flex flex-col items-end gap-2">
            {tableTelemetry ? <LatencyBadge telemetry={tableTelemetry} className="min-w-[11rem] justify-end" /> : null}
          </div>
        </CardHeader>
        <CardContent>
          {assetsQuery.status === 'pending' ? (
            <div className="py-8 text-center text-muted-foreground">Loading…</div>
          ) : assetsQuery.status === 'error' ? (
            <div className="py-8 text-center text-destructive">
              {assetsQuery.error instanceof Error ? assetsQuery.error.message : 'Failed to load assets.'}
            </div>
          ) : (
            <VirtualDataTable
              data={assetsData}
              columns={columns}
              defaultSortColumn={DEFAULT_SORT_COLUMN}
              defaultSortDirection={DEFAULT_SORT_DIRECTION}
              gridTemplateColumns="minmax(12rem, 1fr) minmax(20rem, 1.5fr)"
              hasNextPage={assetsQuery.hasNextPage}
              isFetchingNextPage={assetsQuery.isFetchingNextPage}
              latencySource="api-duckdb"
              dataSource={dataSource}
              onLoadMore={assetsQuery.fetchNextPage}
              onReady={onReady}
              onSearchChange={handleSearchChange}
              onSortChange={handleSortChange}
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
