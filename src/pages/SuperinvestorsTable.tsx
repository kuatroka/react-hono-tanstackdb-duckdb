import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useZero } from '@rocicorp/zero/react';
import { useNavigate } from 'react-router-dom';
import { ZeroVirtualDataTable, type ColumnDef } from '@/components/ZeroVirtualDataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Superinvestor, Schema } from '@/schema';
import {
  queries,
  type SuperinvestorVirtualListContext,
  type SuperinvestorVirtualSortColumn,
  type SuperinvestorVirtualStartRow,
} from '@/zero/queries';
import { preload, PRELOAD_TTL } from '@/zero-preload';

export function SuperinvestorsTablePage({ onReady }: { onReady: () => void }) {
  const z = useZero<Schema>();
  const navigate = useNavigate();
  const rowSelectedRef = useRef(false);

  useEffect(() => {
    preload(z);
  }, [z]);

  const columns = useMemo<ColumnDef<Superinvestor>[]>(() => [
    {
      key: 'cik',
      header: 'CIK',
      sortable: true,
      searchable: true,
      clickable: true,
      render: (value, row, isFocused) => (
        <a
          href={`/superinvestors/${row.cik}`}
          onMouseEnter={() => {
            z.preload(queries.superinvestorByCik(row.cik), { ttl: PRELOAD_TTL });
          }}
          onClick={(e) => {
            e.preventDefault();
            rowSelectedRef.current = true;
            z.preload(queries.superinvestorByCik(row.cik), { ttl: PRELOAD_TTL });
            navigate(`/superinvestors/${encodeURIComponent(row.cik)}`);
          }}
          className={`hover:underline underline-offset-4 cursor-pointer text-foreground outline-none ${isFocused ? 'underline' : ''}`}
        >
          {String(value)}
        </a>
      ),
    },
    {
      key: 'cikName',
      header: 'Name',
      sortable: true,
      searchable: true,
    },
  ], [navigate, z]);

  const getPageQuery = useCallback((
    { dir, limit, settled, start }: {
      dir: 'forward' | 'backward';
      limit: number;
      settled: boolean;
      start: SuperinvestorVirtualStartRow | null;
    },
    listContextParams: SuperinvestorVirtualListContext,
  ) => {
    const ttl = settled ? ('5m' as const) : PRELOAD_TTL;
    return {
      query: queries.superinvestorsVirtualPage(limit, start, dir, listContextParams),
      options: { ttl },
    };
  }, []);

  const getSingleQuery = useCallback(({ id, settled }: { id: string; settled: boolean }) => {
    const ttl = settled ? ('5m' as const) : PRELOAD_TTL;
    return {
      query: queries.superinvestorsVirtualRowById(id),
      options: { ttl },
    };
  }, []);

  const toStartRow = useCallback((row: Superinvestor): SuperinvestorVirtualStartRow => ({
    id: row.id,
    cik: row.cik,
    cikName: row.cikName,
  }), []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl font-bold tracking-tight">Superinvestors</CardTitle>
        </CardHeader>
        <CardContent>
          <ZeroVirtualDataTable<Superinvestor, SuperinvestorVirtualStartRow, SuperinvestorVirtualSortColumn>
            columns={columns}
            defaultSortColumn="cikName"
            defaultSortDirection="asc"
            getPageQuery={getPageQuery}
            getSingleQuery={getSingleQuery}
            getRowKey={(row) => row.id}
            gridTemplateColumns="minmax(12rem, 1fr) minmax(22rem, 1.6fr)"
            historyKey="superinvestorsTableScrollState"
            latencySource="Zero: superinvestors.virtualPage"
            onReady={onReady}
            searchDebounceMs={150}
            searchPlaceholder="Search superinvestors..."
            toStartRow={toStartRow}
          />
        </CardContent>
      </Card>
    </div>
  );
}
