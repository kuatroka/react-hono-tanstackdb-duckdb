import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type SortDirection = 'asc' | 'desc';

const DEFAULT_VISIBLE_ROW_COUNT = 10;
const DEFAULT_ROW_HEIGHT = 52;
const DEFAULT_MIN_SEARCH_LENGTH = 1;

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

export interface ZeroVirtualDataTableProps<
  TRow extends { id: number | string },
> {
  columns: ColumnDef<TRow>[];
  defaultSortColumn: Extract<keyof TRow, string>;
  defaultSortDirection?: SortDirection;
  emptyStateLabel?: string;
  fetchWindow: (params: {
    offset: number;
    limit: number;
    search: string;
    sortColumn: Extract<keyof TRow, string>;
    sortDirection: SortDirection;
  }) => Promise<{
    rows: TRow[];
    total: number;
  }>;
  initialScrollIndex?: number;
  gridTemplateColumns?: string;
  minSearchLength?: number;
  onReady?: () => void;
  onSearchValueChange?: (value: string) => void;
  rowHeight?: number;
  searchPlaceholder?: string;
  searchValue?: string;
  visibleRowCount?: number;
}

export const ZeroVirtualDataTable = memo(function ZeroVirtualDataTable<
  TRow extends { id: number | string },
>({
  columns,
  defaultSortColumn,
  defaultSortDirection = 'asc',
  emptyStateLabel = 'No results found',
  fetchWindow,
  initialScrollIndex = 0,
  gridTemplateColumns,
  minSearchLength = DEFAULT_MIN_SEARCH_LENGTH,
  onReady,
  onSearchValueChange,
  rowHeight = DEFAULT_ROW_HEIGHT,
  searchPlaceholder = 'Search...',
  searchValue,
  visibleRowCount = DEFAULT_VISIBLE_ROW_COUNT,
}: ZeroVirtualDataTableProps<TRow>) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const focusedRowRefs = useRef<Array<HTMLDivElement | null>>([]);
  const inFlightRangesRef = useRef(new Set<string>());
  const activeRequestKeyRef = useRef('');
  const readyCalledRef = useRef(false);
  const initialScrollAppliedRef = useRef(false);
  const [internalSearchValue, setInternalSearchValue] = useState('');
  const [sortColumn, setSortColumn] = useState<Extract<keyof TRow, string>>(defaultSortColumn);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultSortDirection);
  const [focusedRowIndex, setFocusedRowIndex] = useState(-1);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [rowsByIndex, setRowsByIndex] = useState<Record<number, TRow>>({});

  const isSearchControlled = searchValue !== undefined;
  const resolvedSearchValue = isSearchControlled ? searchValue : internalSearchValue;
  const normalizedSearch = resolvedSearchValue.trim();
  const committedSearch = normalizedSearch.length >= minSearchLength ? normalizedSearch : '';
  const requestKey = `${committedSearch}::${sortColumn}::${sortDirection}`;

  useEffect(() => {
    activeRequestKeyRef.current = requestKey;
  }, [requestKey]);

  useEffect(() => {
    setFocusedRowIndex(-1);
    setRowsByIndex({});
    setTotalCount(null);
    readyCalledRef.current = false;
    initialScrollAppliedRef.current = false;
    inFlightRangesRef.current.clear();
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0 });
    }
  }, [requestKey]);

  const placeholderCount = Math.max(initialScrollIndex + visibleRowCount * 2, visibleRowCount * 2);
  const rowCount = totalCount ?? placeholderCount;

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => rowHeight,
    overscan: 8,
  });
  const resolvedGridTemplateColumns = gridTemplateColumns ?? `repeat(${columns.length}, minmax(0, 1fr))`;

  useEffect(() => {
    if (initialScrollAppliedRef.current || totalCount == null) {
      return;
    }

    initialScrollAppliedRef.current = true;
    const targetIndex = Math.min(Math.max(initialScrollIndex, 0), Math.max(totalCount - 1, 0));
    if (targetIndex > 0) {
      virtualizer.scrollToIndex(targetIndex, { align: 'start' });
    }
  }, [initialScrollIndex, totalCount, virtualizer]);

  const handleSearchValueChange = useCallback((value: string) => {
    if (!isSearchControlled) {
      setInternalSearchValue(value);
    }

    onSearchValueChange?.(value);
  }, [isSearchControlled, onSearchValueChange]);

  const handleSort = useCallback((column: Extract<keyof TRow, string>) => {
    if (column === sortColumn) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortColumn(column);
    setSortDirection('asc');
  }, [sortColumn]);

  const focusFirstRow = useCallback(() => {
    setFocusedRowIndex(0);
  }, []);

  const focusNextRow = useCallback(() => {
    setFocusedRowIndex((current) => (current < 0 ? 0 : current + 1));
  }, []);

  const focusPreviousRow = useCallback(() => {
    setFocusedRowIndex((current) => (current <= 0 ? 0 : current - 1));
  }, []);

  const activateFocusedRow = useCallback(() => {
    const focusedElement = document.activeElement;
    const link = focusedElement?.querySelector?.('a') ?? focusedElement?.closest?.('a');
    if (link instanceof HTMLAnchorElement) {
      link.click();
    }
  }, []);

  useEffect(() => {
    if (focusedRowIndex < 0) return;

    const element = focusedRowRefs.current[focusedRowIndex];
    if (element && document.activeElement !== element) {
      element.focus();
    }
  }, [focusedRowIndex, rowsByIndex]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLInputElement) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        focusFirstRow();
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusNextRow();
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusPreviousRow();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      activateFocusedRow();
    }
  }, [activateFocusedRow, focusFirstRow, focusNextRow, focusPreviousRow]);

  const virtualItems = virtualizer.getVirtualItems();
  const requestedRange = useMemo(() => {
    if (virtualItems.length === 0) {
      const start = Math.max(0, initialScrollIndex - visibleRowCount);
      const end = start + visibleRowCount * 2;
      return { start, end };
    }

    const first = virtualItems[0];
    const last = virtualItems[virtualItems.length - 1];
    return {
      start: Math.max(0, first.index - visibleRowCount),
      end: last.index + visibleRowCount,
    };
  }, [initialScrollIndex, virtualItems, visibleRowCount]);

  useEffect(() => {
    const fetchStart = requestedRange.start;
    const fetchEnd = totalCount == null
      ? requestedRange.end
      : Math.min(requestedRange.end, Math.max(totalCount - 1, 0));
    const hasMissingRow = Array.from({ length: Math.max(fetchEnd - fetchStart + 1, 0) }).some((_, index) => (
      rowsByIndex[fetchStart + index] === undefined
    ));

    if (!hasMissingRow && totalCount != null) {
      return;
    }

    const limit = Math.max(visibleRowCount * 3, fetchEnd - fetchStart + 1);
    const rangeKey = `${requestKey}:${fetchStart}:${limit}`;
    if (inFlightRangesRef.current.has(rangeKey)) {
      return;
    }

    inFlightRangesRef.current.add(rangeKey);

    void fetchWindow({
      offset: fetchStart,
      limit,
      search: committedSearch,
      sortColumn,
      sortDirection,
    }).then((result) => {
      if (activeRequestKeyRef.current !== requestKey) {
        return;
      }

      setTotalCount(result.total);
      setRowsByIndex((current) => {
        const next = { ...current };
        result.rows.forEach((row, index) => {
          next[fetchStart + index] = row;
        });
        return next;
      });
    }).catch((error) => {
      console.error('[ZeroVirtualDataTable] Failed to fetch window:', error);
    }).finally(() => {
      inFlightRangesRef.current.delete(rangeKey);
    });
  }, [committedSearch, fetchWindow, requestKey, requestedRange.end, requestedRange.start, rowsByIndex, sortColumn, sortDirection, totalCount, visibleRowCount]);

  useEffect(() => {
    if (readyCalledRef.current) {
      return;
    }

    if (totalCount === 0) {
      readyCalledRef.current = true;
      onReady?.();
      return;
    }

    if (virtualItems.some((item) => rowsByIndex[item.index] !== undefined)) {
      readyCalledRef.current = true;
      onReady?.();
    }
  }, [onReady, rowsByIndex, totalCount, virtualItems]);

  return (
    <div className="space-y-4" onKeyDown={handleKeyDown}>
      <div className="w-full sm:w-96">
        <Input
          name="zero-virtual-data-table-search"
          type="search"
          placeholder={searchPlaceholder}
          value={resolvedSearchValue}
          onChange={(event) => handleSearchValueChange(event.target.value)}
          className="w-full"
        />
      </div>

      <div className="rounded-lg border border-border bg-background">
        <div
          className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-3 text-sm font-medium text-muted-foreground"
        >
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            <span>Browse results</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {totalCount == null ? 'Loading…' : `${totalCount.toLocaleString()} rows`}
          </div>
        </div>

        <div
          className="grid items-center border-b border-border bg-muted/20 px-4 py-3 text-sm font-medium text-muted-foreground"
          style={{ gridTemplateColumns: resolvedGridTemplateColumns }}
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
                onClick={() => handleSort(column.key)}
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

        {totalCount === 0 ? (
          <div className="flex items-center justify-center px-4" style={{ height: rowHeight * visibleRowCount }}>
            <div className="text-sm text-muted-foreground">{emptyStateLabel}</div>
          </div>
        ) : (
          <div
            ref={scrollContainerRef}
            data-testid="zero-virtual-scroll-container"
            className="overflow-y-auto"
            style={{ height: rowHeight * visibleRowCount }}
          >
            <div
              className="relative w-full"
              style={{ height: virtualizer.getTotalSize() }}
            >
              {virtualItems.map((virtualRow) => {
                const row = rowsByIndex[virtualRow.index];

                return (
                  <div
                    key={virtualRow.key}
                    ref={(element) => {
                      focusedRowRefs.current[virtualRow.index] = element;
                    }}
                    data-row-index={virtualRow.index}
                    tabIndex={0}
                    onFocus={() => setFocusedRowIndex(virtualRow.index)}
                    className={cn(
                      'absolute left-0 right-0 border-b border-border bg-background px-4 outline-none',
                      focusedRowIndex === virtualRow.index ? 'bg-muted/50' : undefined,
                    )}
                    style={{
                      height: rowHeight,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div
                      className="grid h-full items-center gap-4 hover:bg-muted/20"
                      style={{ gridTemplateColumns: resolvedGridTemplateColumns }}
                    >
                      {columns.map((column) => (
                        <div
                          key={String(column.key)}
                          className={cn('min-w-0 truncate text-sm', column.className)}
                        >
                          {row
                            ? column.render
                              ? column.render(row[column.key], row, focusedRowIndex === virtualRow.index)
                              : String(row[column.key] ?? '')
                            : (
                              <span className="text-muted-foreground">
                                Loading…
                              </span>
                            )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}) as <TRow extends { id: number | string }>(
  props: ZeroVirtualDataTableProps<TRow>,
) => ReactNode;
