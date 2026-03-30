import {
  type GetPageQueryOptions,
  type GetSingleQueryOptions,
  type QueryResult,
  useHistoryScrollState,
  useZeroVirtualizer,
} from '@rocicorp/zero-virtual/react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type Key, type ReactNode } from 'react';
import { LatencyBadge } from '@/components/LatencyBadge';
import { Input } from '@/components/ui/input';
import { useLatencyMs } from '@/lib/latency';
import { cn } from '@/lib/utils';

type SortDirection = 'asc' | 'desc';

const DEFAULT_VISIBLE_ROW_COUNT = 10;
const DEFAULT_ROW_HEIGHT = 52;

export interface ColumnDef<T> {
  key: Extract<keyof T, string>;
  header: string;
  sortable?: boolean;
  searchable?: boolean;
  clickable?: boolean;
  render?: (value: T[keyof T], row: T, isFocused?: boolean) => ReactNode;
  className?: string;
  headerClassName?: string;
}

export type ZeroVirtualListContext<TSortColumn extends string> = Readonly<{
  search: string;
  sortColumn: TSortColumn;
  sortDirection: SortDirection;
}>;

interface ZeroVirtualTableSearchInputProps {
  initialValue: string;
  placeholder: string;
  debounceMs: number;
  onQueryCommit: (value: string) => void;
}

const ZeroVirtualTableSearchInput = memo(function ZeroVirtualTableSearchInput({
  initialValue,
  placeholder,
  debounceMs,
  onQueryCommit,
}: ZeroVirtualTableSearchInputProps) {
  const [inputValue, setInputValue] = useState(initialValue);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    setInputValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    if (debounceMs <= 0) {
      onQueryCommit(inputValue);
      return;
    }

    const timeoutId = setTimeout(() => {
      onQueryCommit(inputValue);
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [debounceMs, inputValue, onQueryCommit]);

  return (
    <div className="w-full sm:w-96">
      <Input
        type="search"
        placeholder={placeholder}
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value)}
        className="w-full"
      />
    </div>
  );
});

ZeroVirtualTableSearchInput.displayName = 'ZeroVirtualTableSearchInput';

interface ZeroVirtualTableToolbarProps {
  latencyMs: number | null;
  latencySource?: string;
  onSearchCommit: (value: string) => void;
  searchDebounceMs: number;
  searchPlaceholder: string;
  searchValue: string;
}

const ZeroVirtualTableToolbar = memo(function ZeroVirtualTableToolbar({
  latencyMs,
  latencySource,
  onSearchCommit,
  searchDebounceMs,
  searchPlaceholder,
  searchValue,
}: ZeroVirtualTableToolbarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <ZeroVirtualTableSearchInput
        initialValue={searchValue}
        placeholder={searchPlaceholder}
        debounceMs={searchDebounceMs}
        onQueryCommit={onSearchCommit}
      />
      {latencySource ? <LatencyBadge ms={latencyMs} source={latencySource} /> : null}
    </div>
  );
});

ZeroVirtualTableToolbar.displayName = 'ZeroVirtualTableToolbar';

interface ZeroVirtualTableHeaderProps<
  TRow extends { id: number | string },
  TSortColumn extends Extract<keyof TRow, string>,
> {
  columns: ColumnDef<TRow>[];
  gridTemplateColumns: string;
  onSort: (column: TSortColumn) => void;
  sortColumn: TSortColumn;
  sortDirection: SortDirection;
}

function ZeroVirtualTableHeaderInner<
  TRow extends { id: number | string },
  TSortColumn extends Extract<keyof TRow, string>,
>({
  columns,
  gridTemplateColumns,
  onSort,
  sortColumn,
  sortDirection,
}: ZeroVirtualTableHeaderProps<TRow, TSortColumn>) {
  return (
    <div
      className="grid items-center border-b border-border bg-muted/30 px-4 py-3 text-sm font-medium text-muted-foreground"
      style={{ gridTemplateColumns }}
    >
      {columns.map((column) => {
        const isSorted = sortColumn === column.key;

        if (!column.sortable) {
          return (
            <div key={String(column.key)} className={cn('truncate', column.headerClassName)}>
              {column.header}
            </div>
          );
        }

        return (
          <button
            key={String(column.key)}
            type="button"
            onClick={() => onSort(column.key as TSortColumn)}
            className={cn(
              'flex min-w-0 items-center gap-2 truncate text-left transition-colors hover:text-foreground',
              column.headerClassName,
            )}
          >
            <span className="truncate">{column.header}</span>
            {isSorted ? (
              sortDirection === 'asc' ? (
                <ChevronUp className="h-4 w-4 shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 shrink-0" />
              )
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

const ZeroVirtualTableHeader = memo(ZeroVirtualTableHeaderInner) as <
  TRow extends { id: number | string },
  TSortColumn extends Extract<keyof TRow, string>,
>(
  props: ZeroVirtualTableHeaderProps<TRow, TSortColumn>,
) => ReactNode;

interface ZeroVirtualTableViewportProps<
  TRow extends { id: number | string },
  TStartRow,
  TSortColumn extends Extract<keyof TRow, string>,
> {
  columns: ColumnDef<TRow>[];
  emptyStateLabel: string;
  getPageQuery: (
    options: GetPageQueryOptions<TStartRow>,
    listContextParams: ZeroVirtualListContext<TSortColumn>,
  ) => QueryResult<TRow>;
  getSingleQuery: (options: GetSingleQueryOptions) => QueryResult<TRow | undefined>;
  getRowKey: (row: TRow) => Key;
  gridTemplateColumns: string;
  historyKey: string;
  listContextParams: ZeroVirtualListContext<TSortColumn>;
  onReadyChange: (isReady: boolean) => void;
  rowHeight: number;
  toStartRow: (row: TRow) => TStartRow;
  visibleRowCount: number;
}

function ZeroVirtualTableViewportInner<
  TRow extends { id: number | string },
  TStartRow,
  TSortColumn extends Extract<keyof TRow, string>,
>({
  columns,
  emptyStateLabel,
  getPageQuery,
  getSingleQuery,
  getRowKey,
  gridTemplateColumns,
  historyKey,
  listContextParams,
  onReadyChange,
  rowHeight,
  toStartRow,
  visibleRowCount,
}: ZeroVirtualTableViewportProps<TRow, TStartRow, TSortColumn>) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useHistoryScrollState<TStartRow>(historyKey);

  const getScrollElement = useCallback(() => viewportRef.current, []);
  const estimateSize = useCallback(() => rowHeight, [rowHeight]);
  const resolvePageQuery = useCallback(
    (options: GetPageQueryOptions<TStartRow>) => getPageQuery(options, listContextParams),
    [getPageQuery, listContextParams],
  );

  const { complete, rowAt, rowsEmpty, settled, virtualizer } = useZeroVirtualizer<
    HTMLDivElement,
    HTMLDivElement,
    ZeroVirtualListContext<TSortColumn>,
    TRow,
    TStartRow
  >({
    estimateSize,
    getPageQuery: resolvePageQuery,
    getRowKey,
    getScrollElement,
    getSingleQuery,
    listContextParams,
    onScrollStateChange: setScrollState,
    scrollState,
    toStartRow,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const isReady = rowsEmpty || complete || rowAt(0) !== undefined;

  useEffect(() => {
    onReadyChange(isReady);
  }, [isReady, onReadyChange]);

  return (
    <div
      ref={viewportRef}
      className="overflow-y-auto"
      style={{ height: rowHeight * visibleRowCount }}
    >
      {rowsEmpty && complete ? (
        <div className="flex h-full items-center justify-center px-4 text-sm text-muted-foreground">
          {emptyStateLabel}
        </div>
      ) : (
        <div
          className="relative"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualItems.map((virtualRow) => {
            const row = rowAt(virtualRow.index);

            return (
              <div
                key={virtualRow.key}
                className="absolute left-0 right-0 border-b border-border bg-background px-4"
                style={{
                  height: rowHeight,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div
                  className="grid h-full items-center gap-4 hover:bg-muted/20"
                  style={{ gridTemplateColumns }}
                >
                  {columns.map((column, columnIndex) => (
                    <div
                      key={String(column.key)}
                      className={cn('min-w-0 truncate text-sm', column.className)}
                    >
                      {row
                        ? column.render
                          ? column.render(row[column.key], row, false)
                          : String(row[column.key] ?? '')
                        : columnIndex === 0
                          ? (
                            <span className="text-muted-foreground">
                              {settled ? 'Loading…' : 'Loading...'}
                            </span>
                          )
                          : null}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const ZeroVirtualTableViewport = memo(ZeroVirtualTableViewportInner) as <
  TRow extends { id: number | string },
  TStartRow,
  TSortColumn extends Extract<keyof TRow, string>,
>(
  props: ZeroVirtualTableViewportProps<TRow, TStartRow, TSortColumn>,
) => ReactNode;

interface ZeroVirtualDataTableProps<
  TRow extends { id: number | string },
  TStartRow,
  TSortColumn extends Extract<keyof TRow, string>,
> {
  columns: ColumnDef<TRow>[];
  defaultSortColumn: TSortColumn;
  defaultSortDirection?: SortDirection;
  emptyStateLabel?: string;
  getPageQuery: (
    options: GetPageQueryOptions<TStartRow>,
    listContextParams: ZeroVirtualListContext<TSortColumn>,
  ) => QueryResult<TRow>;
  getSingleQuery: (options: GetSingleQueryOptions) => QueryResult<TRow | undefined>;
  getRowKey: (row: TRow) => Key;
  gridTemplateColumns: string;
  historyKey: string;
  latencySource?: string | ((listContextParams: ZeroVirtualListContext<TSortColumn>) => string);
  onReady?: () => void;
  rowHeight?: number;
  searchDebounceMs?: number;
  searchPlaceholder?: string;
  toStartRow: (row: TRow) => TStartRow;
  visibleRowCount?: number;
}

function ZeroVirtualDataTableInner<
  TRow extends { id: number | string },
  TStartRow,
  TSortColumn extends Extract<keyof TRow, string>,
>({
  columns,
  defaultSortColumn,
  defaultSortDirection = 'asc',
  emptyStateLabel = 'No results found',
  getPageQuery,
  getSingleQuery,
  getRowKey,
  gridTemplateColumns,
  historyKey,
  latencySource,
  onReady,
  rowHeight = DEFAULT_ROW_HEIGHT,
  searchDebounceMs = 150,
  searchPlaceholder = 'Search...',
  toStartRow,
  visibleRowCount = DEFAULT_VISIBLE_ROW_COUNT,
}: ZeroVirtualDataTableProps<TRow, TStartRow, TSortColumn>) {
  const [committedSearch, setCommittedSearch] = useState('');
  const [sortColumn, setSortColumn] = useState<TSortColumn>(defaultSortColumn);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultSortDirection);
  const [isQueryReady, setIsQueryReady] = useState(false);
  const readyCalledRef = useRef(false);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  const listContextParams = useMemo<ZeroVirtualListContext<TSortColumn>>(
    () => ({
      search: committedSearch.trim(),
      sortColumn,
      sortDirection,
    }),
    [committedSearch, sortColumn, sortDirection],
  );

  const latencyResetKey = `${listContextParams.search}:${listContextParams.sortColumn}:${listContextParams.sortDirection}`;
  const resolvedLatencySource =
    typeof latencySource === 'function' ? latencySource(listContextParams) : latencySource;
  const activeLatencyMs = useLatencyMs({
    isReady: isQueryReady,
    resetKey: latencyResetKey,
  });

  useEffect(() => {
    setIsQueryReady(false);
  }, [latencyResetKey]);

  useEffect(() => {
    if (!isQueryReady || readyCalledRef.current) {
      return;
    }

    readyCalledRef.current = true;
    onReadyRef.current?.();
  }, [isQueryReady]);

  const handleSearchCommit = useCallback((value: string) => {
    setCommittedSearch(value);
  }, []);

  const handleSort = useCallback((column: TSortColumn) => {
    if (column === sortColumn) {
      setSortDirection((currentDirection) => (currentDirection === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortColumn(column);
    setSortDirection('asc');
  }, [sortColumn]);

  const handleReadyChange = useCallback((ready: boolean) => {
    setIsQueryReady(ready);
  }, []);

  return (
    <div className="space-y-4">
      <ZeroVirtualTableToolbar
        latencyMs={activeLatencyMs}
        latencySource={resolvedLatencySource}
        onSearchCommit={handleSearchCommit}
        searchDebounceMs={searchDebounceMs}
        searchPlaceholder={searchPlaceholder}
        searchValue={committedSearch}
      />

      <div className="overflow-hidden rounded-lg border border-border bg-background">
        <ZeroVirtualTableHeader
          columns={columns}
          gridTemplateColumns={gridTemplateColumns}
          onSort={handleSort}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
        />
        <ZeroVirtualTableViewport
          columns={columns}
          emptyStateLabel={emptyStateLabel}
          getPageQuery={getPageQuery}
          getSingleQuery={getSingleQuery}
          getRowKey={getRowKey}
          gridTemplateColumns={gridTemplateColumns}
          historyKey={historyKey}
          listContextParams={listContextParams}
          onReadyChange={handleReadyChange}
          rowHeight={rowHeight}
          toStartRow={toStartRow}
          visibleRowCount={visibleRowCount}
        />
      </div>
    </div>
  );
}

const MemoizedZeroVirtualDataTable = memo(ZeroVirtualDataTableInner);
MemoizedZeroVirtualDataTable.displayName = 'ZeroVirtualDataTable';

export const ZeroVirtualDataTable = MemoizedZeroVirtualDataTable as typeof ZeroVirtualDataTableInner;
