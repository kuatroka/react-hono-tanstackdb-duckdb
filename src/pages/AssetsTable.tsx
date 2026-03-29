import { useEffect, useRef, useMemo } from 'react';
import { useLiveQuery } from '@tanstack/react-db';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { DataTable, ColumnDef } from '@/components/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LatencyBadge } from '@/components/LatencyBadge';
import { AllAssetsActivityChart } from '@/components/charts/AllAssetsActivityChart';
import { useContentReady } from '@/hooks/useContentReady';
import { assetsCollection, type Asset } from '@/collections';

const ASSETS_TOTAL_ROWS = 32000;

export function AssetsTablePage() {
  return <AssetsTableSurface />;
}

function AssetsTableSurface() {
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false }) as { page?: string; search?: string };
  const { onReady } = useContentReady();
  const tablePageSize = 10;

  const rawPage = searchParams.page;
  const parsedPage = rawPage ? parseInt(rawPage, 10) : 1;
  const currentPage = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;

  const trimmedSearch = (searchParams.search ?? '').trim();

  // Use TanStack DB useLiveQuery for instant local queries
  // Data is preloaded on app init, so queries execute against local collection
  const { data: assetsData, isLoading } = useLiveQuery(
    (q) => q.from({ assets: assetsCollection }),
  );

  // Filter assets client-side based on search term
  // This filtering happens instantly against local data
  const filteredAssets = useMemo(() => {
    if (!assetsData) return [];
    if (!trimmedSearch) return assetsData;

    const lowerSearch = trimmedSearch.toLowerCase();
    return assetsData.filter((asset: Asset) =>
      asset.asset.toLowerCase().includes(lowerSearch) ||
      asset.assetName.toLowerCase().includes(lowerSearch)
    );
  }, [assetsData, trimmedSearch]);

  // Signal ready when data is available
  const readyCalledRef = useRef(false);
  useEffect(() => {
    if (readyCalledRef.current) return;
    if (assetsData !== undefined) {
      readyCalledRef.current = true;
      onReady();
    }
  }, [assetsData, onReady]);

  const handlePageChange = (newPage: number) => {
    navigate({
      to: '/assets',
      search: { page: String(newPage), search: trimmedSearch || undefined },
    });
  };

  const handleSearchChange = (value: string) => {
    navigate({
      to: '/assets',
      search: { page: '1', search: value.trim() || undefined },
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
    <div className="w-full px-4 py-8 mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Assets</h1>
        <p className="text-muted-foreground">Browse and search all assets</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span>Assets Table</span>
              <LatencyBadge latencyMs={isLoading ? undefined : 0} source="tsdb-indexeddb" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-8 text-center text-muted-foreground">Loading…</div>
            ) : (
              <DataTable
                data={filteredAssets || []}
                columns={columns}
                searchPlaceholder="Search assets..."
                defaultPageSize={tablePageSize}
                defaultSortColumn="assetName"
                defaultSortDirection="asc"
                initialPage={currentPage}
                onPageChange={handlePageChange}
                onSearchChange={handleSearchChange}
                searchValue={trimmedSearch}
                searchDisabled={!!trimmedSearch}
                totalCount={trimmedSearch ? filteredAssets.length : ASSETS_TOTAL_ROWS}
              />
            )}
          </CardContent>
        </Card>

        <AllAssetsActivityChart />
      </div>
    </div>
  );
}
