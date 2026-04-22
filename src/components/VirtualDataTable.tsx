import { useVirtualizer } from '@tanstack/react-virtual';
import UFuzzy from '@leeoniya/ufuzzy';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type Key, type ReactNode } from 'react';
import { LatencyBadge } from '@/components/LatencyBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLatencyMs } from '@/lib/latency';
import { createLegacyPerfTelemetry, type PerfSource, type PerfTelemetry } from '@/lib/perf/telemetry';
import {
  rerankUFuzzyTableRows,
  runUFuzzyIndexSearch,
  UFUZZY_OPTIONS,
  type UFuzzyPreviousFilter,
  type UFuzzyTableRankingConfig,
} from '@/lib/ufuzzy-search';
import { cn } from '@/lib/utils';

type SortDirection = 'asc' | 'desc';
type TableSearchStrategy = 'includes' | 'ufuzzy';

const DEFAULT_VISIBLE_ROW_COUNT = 10;
const DEFAULT_ROW_HEIGHT = 52;
const DEFAULT_CLIENT_PAGE_SIZE = 100;
const DEFAULT_MIN_SEARCH_CHARACTERS = 2;

const SearchGlyph = memo(function SearchGlyph() {
  return <Search className="h-4 w-4" />;
});

interface SearchToggleButtonProps {
  isExpanded: boolean;
  onToggle: () => void;
}

const SearchToggleButton = memo(function SearchToggleButton({
  isExpanded,
  onToggle,
}: SearchToggleButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onToggle}
      className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
      aria-label={isExpanded ? 'Collapse search' : 'Expand search'}
    >
      <SearchGlyph />
    </Button>
  );
});

interface SortIndicatorProps {
  direction: SortDirection;
}

const SortIndicator = memo(function SortIndicator({ direction }: SortIndicatorProps) {
  return direction === 'asc'
    ? <ChevronUp className="h-4 w-4 shrink-0" />
    : <ChevronDown className="h-4 w-4 shrink-0" />;
});

interface SortHeaderButtonProps {
  columnKey: string;
  header: string;
  isSorted: boolean;
  sortDirection: SortDirection;
  headerClassName?: string;
  onSort: (columnKey: string) => void;
}

const SortHeaderButton = memo(function SortHeaderButton({
  columnKey,
  header,
  isSorted,
  sortDirection,
  headerClassName,
  onSort,
}: SortHeaderButtonProps) {
  const handleClick = useCallback(() => {
    onSort(columnKey);
  }, [columnKey, onSort]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn('flex min-w-0 items-center gap-2 truncate text-left transition-colors hover:text-foreground', headerClassName)}
    >
      <span className="truncate">{header}</span>
      {isSorted ? <SortIndicator direction={sortDirection} /> : null}
    </button>
  );
});

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

interface VirtualTableSearchInputProps {
  placeholder: string;
  value: string;
  onArrowDown?: () => void;
  onArrowUp?: () => void;
  onEnter?: () => void;
  onFocus?: () => void;
  onTabToResults?: () => void;
  onValueChange: (value: string) => void;
  autoFocus?: boolean;
  containerClassName?: string;
  inputClassName?: string;
}

function VirtualTableSearchInput({
  placeholder,
  value,
  onArrowDown,
  onArrowUp,
  onEnter,
  onFocus,
  onTabToResults,
  onValueChange,
  autoFocus = false,
  containerClassName = 'w-52 sm:w-64',
  inputClassName,
}: VirtualTableSearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!autoFocus) return;
    const frameId = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frameId);
  }, [autoFocus]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && onArrowDown) {
      event.preventDefault();
      onArrowDown();
      return;
    }
    if (event.key === 'ArrowUp' && onArrowUp) {
      event.preventDefault();
      onArrowUp();
      return;
    }
    if (event.key === 'Tab' && !event.shiftKey && onTabToResults) {
      event.preventDefault();
      onTabToResults();
      return;
    }
    if (event.key === 'Enter' && onEnter) {
      event.preventDefault();
      onEnter();
    }
  }, [onArrowDown, onArrowUp, onEnter, onTabToResults]);

  return (
    <div className={containerClassName}>
      <Input
        ref={inputRef}
        autoFocus={autoFocus}
        name="virtual-table-search"
        type="search"
        placeholder={placeholder}
        value={value}
        onFocus={onFocus}
        onKeyDown={handleKeyDown}
        onChange={(event) => onValueChange(event.target.value)}
        className={cn('h-8 w-full', inputClassName)}
      />
    </div>
  );
}

interface VirtualTableToolbarProps {
  telemetry?: PerfTelemetry | null;
}

const VirtualTableToolbar = memo(function VirtualTableToolbar({ telemetry }: VirtualTableToolbarProps) {
  if (!telemetry) {
    return null;
  }

  return (
    <div className="flex items-center justify-end">
      <LatencyBadge telemetry={telemetry} />
    </div>
  );
});

interface VirtualTableHeaderSearchProps {
  placeholder: string;
  searchValue: string;
  searchTelemetry?: PerfTelemetry | null;
  tableContainerRef: React.RefObject<HTMLDivElement | null>;
  onArrowDown: () => void;
  onArrowUp: () => void;
  onEnter: () => void;
  onSearchFocus: () => void;
  onSearchValueChange: (value: string) => void;
  onTabToResults: () => void;
}

const VirtualTableHeaderSearch = memo(function VirtualTableHeaderSearch({
  placeholder,
  searchValue,
  searchTelemetry,
  tableContainerRef,
  onArrowDown,
  onArrowUp,
  onEnter,
  onSearchFocus,
  onSearchValueChange,
  onTabToResults,
}: VirtualTableHeaderSearchProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (searchValue) {
      setIsExpanded(true);
    }
  }, [searchValue]);

  useEffect(() => {
    if (!isExpanded || searchValue.trim()) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (tableContainerRef.current?.contains(target)) {
        return;
      }
      setIsExpanded(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isExpanded, searchValue, tableContainerRef]);

  const handleToggle = useCallback(() => {
    setIsExpanded((current) => !current);
  }, []);

  return (
    <div className="flex items-center justify-between gap-4 border-b border-border bg-background px-4 py-2">
      <div className="flex min-w-0 flex-1 items-center justify-start gap-2">
        <SearchToggleButton isExpanded={isExpanded} onToggle={handleToggle} />
        {isExpanded ? (
          <VirtualTableSearchInput
            autoFocus
            placeholder={placeholder}
            value={searchValue}
            onArrowDown={onArrowDown}
            onArrowUp={onArrowUp}
            onEnter={onEnter}
            onFocus={onSearchFocus}
            onTabToResults={onTabToResults}
            onValueChange={onSearchValueChange}
          />
        ) : null}
      </div>
      <div className="flex min-h-8 items-center justify-end">
        {searchTelemetry ? <LatencyBadge telemetry={searchTelemetry} className="min-w-[11rem] justify-center" /> : null}
      </div>
    </div>
  );
});

interface VirtualDataTableProps<T extends { id: number | string }> {
  data: T[];
  columns: ColumnDef<T>[];
  defaultSortColumn: Extract<keyof T, string>;
  defaultSortDirection?: SortDirection;
  emptyStateLabel?: string;
  getRowKey?: (row: T) => Key;
  gridTemplateColumns: string;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  latencySource?: PerfSource;
  onLoadMore?: () => void | Promise<unknown>;
  onReady?: () => void;
  dataSource?: PerfSource;
  onRowClick?: (row: T) => void;
  onSearchChange?: (value: string) => void;
  onSearchTelemetryChange?: (searchTelemetry: PerfTelemetry | null) => void;
  onSortChange?: (column: Extract<keyof T, string>, direction: SortDirection) => void;
  onTableTelemetryChange?: (tableTelemetry: PerfTelemetry | null) => void;
  rowHeight?: number;
  expandedRowHeight?: number;
  expandedRowKey?: Key | null;
  renderExpandedRow?: (row: T) => ReactNode;
  clientPageSize?: number;
  minimumSearchCharacters?: number;
  searchDebounceMs?: number;
  searchPlaceholder?: string;
  searchStrategy?: TableSearchStrategy;
  ufuzzyRanking?: UFuzzyTableRankingConfig<T>;
  searchTelemetryLabel?: string;
  searchValue?: string;
  tableTelemetryLabel?: string;
  visibleRowCount?: number;
}

export function VirtualDataTable<T extends { id: number | string }>({
  data,
  columns,
  defaultSortColumn,
  defaultSortDirection = 'asc',
  emptyStateLabel = 'No results found',
  getRowKey,
  gridTemplateColumns,
  hasNextPage = false,
  isFetchingNextPage = false,
  latencySource = 'tsdb-memory',
  onLoadMore,
  onReady,
  dataSource,
  onRowClick,
  onSearchChange,
  onSearchTelemetryChange,
  onSortChange,
  onTableTelemetryChange,
  rowHeight = DEFAULT_ROW_HEIGHT,
  expandedRowHeight = 0,
  expandedRowKey = null,
  renderExpandedRow,
  clientPageSize = DEFAULT_CLIENT_PAGE_SIZE,
  minimumSearchCharacters = DEFAULT_MIN_SEARCH_CHARACTERS,
  searchDebounceMs = 150,
  searchPlaceholder = 'Search...',
  searchStrategy = 'includes',
  ufuzzyRanking,
  searchTelemetryLabel = 'search',
  searchValue = '',
  tableTelemetryLabel = 'virtual table',
  visibleRowCount = DEFAULT_VISIBLE_ROW_COUNT,
}: VirtualDataTableProps<T>) {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Array<HTMLDivElement | null>>([]);
  const readyCalledRef = useRef(false);
  const ufuzzyRef = useRef(new UFuzzy(UFUZZY_OPTIONS));
  const previousUFuzzyFilterRef = useRef<UFuzzyPreviousFilter>({ query: '', idxs: null, haystackSize: 0 });
  const [draftSearchValue, setDraftSearchValue] = useState(searchValue);
  const [committedSearch, setCommittedSearch] = useState(searchValue.trim());
  const [sortColumn, setSortColumn] = useState<Extract<keyof T, string>>(defaultSortColumn);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultSortDirection);
  const [focusedRowIndex, setFocusedRowIndex] = useState(-1);
  const [isTableReady, setIsTableReady] = useState(false);
  const [revealedRowCount, setRevealedRowCount] = useState(() => Math.min(data.length, clientPageSize));

  useEffect(() => {
    const nextCommittedSearch = searchValue.trim();
    setDraftSearchValue((current) => current === searchValue ? current : searchValue);
    setCommittedSearch((current) => current === nextCommittedSearch ? current : nextCommittedSearch);
  }, [searchValue]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setFocusedRowIndex(-1);
      setCommittedSearch(draftSearchValue.trim());
    }, searchDebounceMs);

    return () => clearTimeout(timeoutId);
  }, [draftSearchValue, searchDebounceMs]);

  const normalizedSearch = useMemo(() => {
    return committedSearch.length >= minimumSearchCharacters ? committedSearch : '';
  }, [committedSearch, minimumSearchCharacters]);

  useEffect(() => {
    onSearchChange?.(normalizedSearch);
  }, [normalizedSearch, onSearchChange]);

  const searchableColumns = useMemo(
    () => columns.filter((column) => column.searchable),
    [columns],
  );

  const searchHaystack = useMemo(() => {
    if (searchStrategy !== 'ufuzzy') {
      return [] as string[];
    }

    return data.map((row) =>
      searchableColumns
        .map((column) => row[column.key])
        .filter((value) => value != null)
        .map((value) => String(value))
        .join(' | '),
    );
  }, [data, searchStrategy, searchableColumns]);

  const filteredSearch = useMemo(() => {
    if (!normalizedSearch) {
      return {
        rows: data,
        idxs: null as number[] | null,
      };
    }

    if (searchStrategy === 'ufuzzy') {
      const fuzzyMatch = runUFuzzyIndexSearch(
        ufuzzyRef.current,
        searchHaystack,
        normalizedSearch,
        previousUFuzzyFilterRef.current,
      );
      const rankedRows = fuzzyMatch.rankedIndexes.map((index) => data[index]);

      return {
        rows: ufuzzyRanking
          ? rerankUFuzzyTableRows(rankedRows, normalizedSearch, ufuzzyRanking)
          : rankedRows,
        idxs: fuzzyMatch.idxs,
      };
    }

    const query = normalizedSearch.toLowerCase();
    return {
      rows: data.filter((row) =>
        searchableColumns.some((column) => {
          const value = row[column.key];
          if (value == null) return false;
          return String(value).toLowerCase().includes(query);
        }),
      ),
      idxs: null as number[] | null,
    };
  }, [data, normalizedSearch, searchHaystack, searchStrategy, searchableColumns, ufuzzyRanking]);

  useEffect(() => {
    if (!normalizedSearch || searchStrategy !== 'ufuzzy') {
      previousUFuzzyFilterRef.current = { query: normalizedSearch, idxs: null, haystackSize: searchHaystack.length };
      return;
    }

    previousUFuzzyFilterRef.current = { query: normalizedSearch, idxs: filteredSearch.idxs, haystackSize: searchHaystack.length };
  }, [filteredSearch.idxs, normalizedSearch, searchHaystack.length, searchStrategy]);

  const hasSearch = normalizedSearch.length > 0;
  const hasExplicitSort = sortColumn !== defaultSortColumn || sortDirection !== defaultSortDirection;
  const shouldReorderRows = hasSearch || hasExplicitSort;
  const orderedData = useMemo(() => {
    if (!shouldReorderRows || (hasSearch && searchStrategy === 'ufuzzy' && !hasExplicitSort)) {
      return filteredSearch.rows;
    }

    const sorted = [...filteredSearch.rows];
    sorted.sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortDirection === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
    return sorted;
  }, [filteredSearch.rows, hasExplicitSort, hasSearch, searchStrategy, shouldReorderRows, sortColumn, sortDirection]);

  const tableLatencyResetKey = `${String(sortColumn)}:${sortDirection}:${data.length}:${shouldReorderRows}`;
  const searchLatencyResetKey = normalizedSearch;
  const readyResetKey = `${tableLatencyResetKey}:${searchLatencyResetKey}:${orderedData.length}`;
  const hasRemotePagination = Boolean(onLoadMore || hasNextPage);
  const expandedRowKeyString = expandedRowKey == null ? null : String(expandedRowKey);

  useEffect(() => {
    if (hasRemotePagination) {
      setRevealedRowCount(orderedData.length);
      return;
    }

    setRevealedRowCount(Math.min(orderedData.length, clientPageSize));
  }, [clientPageSize, hasRemotePagination, orderedData.length, readyResetKey]);

  useEffect(() => {
    readyCalledRef.current = false;
    setIsTableReady(false);
    const frameId = requestAnimationFrame(() => setIsTableReady(true));
    return () => cancelAnimationFrame(frameId);
  }, [readyResetKey]);

  const tableLatencyMs = useLatencyMs({
    isReady: isTableReady,
    resetKey: tableLatencyResetKey,
    enabled: Boolean(latencySource),
  });

  const searchLatencyMs = useLatencyMs({
    isReady: isTableReady,
    resetKey: searchLatencyResetKey,
    enabled: Boolean(latencySource && normalizedSearch),
  });

  const tableTelemetry = useMemo(() => {
    if (!latencySource || tableLatencyMs == null) {
      return null;
    }

    return createLegacyPerfTelemetry({
      label: tableTelemetryLabel,
      ms: tableLatencyMs,
      source: dataSource ?? latencySource,
    });
  }, [dataSource, latencySource, tableLatencyMs, tableTelemetryLabel]);

  const searchTelemetry = useMemo(() => {
    if (!latencySource || !normalizedSearch || searchLatencyMs == null) {
      return null;
    }

    return createLegacyPerfTelemetry({
      label: searchTelemetryLabel,
      ms: searchLatencyMs,
      source: dataSource ?? latencySource,
    });
  }, [dataSource, latencySource, normalizedSearch, searchLatencyMs, searchTelemetryLabel]);

  useEffect(() => {
    onTableTelemetryChange?.(tableTelemetry);
  }, [onTableTelemetryChange, tableTelemetry]);

  useEffect(() => {
    onSearchTelemetryChange?.(searchTelemetry);
  }, [onSearchTelemetryChange, searchTelemetry]);

  useEffect(() => {
    if (!isTableReady || readyCalledRef.current) return;
    readyCalledRef.current = true;
    onReady?.();
  }, [isTableReady, onReady]);

  const visibleData = useMemo(() => {
    if (hasRemotePagination) {
      return orderedData;
    }

    return orderedData.slice(0, revealedRowCount);
  }, [hasRemotePagination, orderedData, revealedRowCount]);

  const resolveRowKey = useCallback((row: T) => {
    const resolved = getRowKey ? getRowKey(row) : row.id;
    return String(resolved);
  }, [getRowKey]);

  const virtualizer = useVirtualizer({
    count: visibleData.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: (index) => {
      const row = visibleData[index];
      if (!row) {
        return rowHeight;
      }
      const rowKey = resolveRowKey(row);
      return renderExpandedRow && expandedRowKeyString === rowKey
        ? rowHeight + expandedRowHeight
        : rowHeight;
    },
    overscan: 8,
  });

  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    virtualizer.measure();
  }, [expandedRowHeight, expandedRowKeyString, renderExpandedRow, virtualizer]);

  useEffect(() => {
    if (focusedRowIndex < 0) return;
    rowRefs.current[focusedRowIndex]?.focus();
  }, [focusedRowIndex, virtualItems]);

  const handleSearchValueChange = useCallback((value: string) => {
    setDraftSearchValue(value);
  }, []);

  const handleSearchFocus = useCallback(() => {
    setFocusedRowIndex(-1);
  }, []);

  const handleSort = useCallback((column: string) => {
    setFocusedRowIndex(-1);
    if (column === sortColumn) {
      setSortDirection((current) => {
        const nextDirection = current === 'asc' ? 'desc' : 'asc';
        onSortChange?.(column as Extract<keyof T, string>, nextDirection);
        return nextDirection;
      });
      return;
    }
    setSortColumn(column as Extract<keyof T, string>);
    setSortDirection('asc');
    onSortChange?.(column as Extract<keyof T, string>, 'asc');
  }, [onSortChange, sortColumn]);

  const focusFirstRow = useCallback(() => {
    if (orderedData.length === 0) return;
    setFocusedRowIndex(0);
  }, [orderedData.length]);

  const focusNextRow = useCallback(() => {
    setFocusedRowIndex((current) => {
      if (orderedData.length === 0) return -1;
      if (current < 0) return 0;
      return Math.min(current + 1, orderedData.length - 1);
    });
  }, [orderedData.length]);

  const focusPreviousRow = useCallback(() => {
    setFocusedRowIndex((current) => {
      if (orderedData.length === 0) return -1;
      if (current <= 0) return 0;
      return current - 1;
    });
  }, [orderedData.length]);

  const focusRowElement = useCallback((index: number) => {
    requestAnimationFrame(() => {
      rowRefs.current[index]?.focus();
    });
  }, []);

  const activateRowElement = useCallback((index: number) => {
    requestAnimationFrame(() => {
      const rowElement = rowRefs.current[index];
      const link = rowElement?.querySelector?.('a') ?? rowElement?.closest?.('a');
      if (link instanceof HTMLAnchorElement) {
        link.click();
      }
    });
  }, []);

  const triggerRowClick = useCallback((row: T) => {
    onRowClick?.(row);
  }, [onRowClick]);

  const handleSearchEnter = useCallback(() => {
    focusFirstRow();
    focusRowElement(0);
    activateRowElement(0);
  }, [activateRowElement, focusFirstRow, focusRowElement]);

  const activateFocusedRow = useCallback(() => {
    const activeElement = document.activeElement;
    const activeRowIndex = activeElement instanceof HTMLElement
      ? Number(activeElement.dataset.rowIndex ?? activeElement.closest?.('[data-row-index]')?.getAttribute('data-row-index'))
      : Number.NaN;
    if (Number.isFinite(activeRowIndex) && activeRowIndex >= 0) {
      const row = visibleData[activeRowIndex];
      if (row) {
        triggerRowClick(row);
      }
    }
    const link = activeElement?.querySelector?.('a') ?? activeElement?.closest?.('a');
    if (link instanceof HTMLAnchorElement) {
      link.click();
    }
  }, [triggerRowClick, visibleData]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLInputElement) return;
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
  }, [activateFocusedRow, focusNextRow, focusPreviousRow]);

  useEffect(() => {
    const canLoadMoreRemoteRows = hasNextPage && !isFetchingNextPage && Boolean(onLoadMore);
    const hasMoreClientRows = !hasRemotePagination && revealedRowCount < orderedData.length;

    if (!canLoadMoreRemoteRows && !hasMoreClientRows) {
      return;
    }

    const lastItem = virtualItems[virtualItems.length - 1];
    if (!lastItem) {
      return;
    }

    if (lastItem.index >= Math.max(visibleData.length - 5, 0)) {
      if (hasMoreClientRows) {
        setRevealedRowCount((current) => Math.min(current + clientPageSize, orderedData.length));
        return;
      }

      void onLoadMore();
    }
  }, [
    clientPageSize,
    hasNextPage,
    hasRemotePagination,
    isFetchingNextPage,
    onLoadMore,
    orderedData.length,
    revealedRowCount,
    virtualItems,
    visibleData.length,
  ]);

  const showLoadMoreHint = hasNextPage || isFetchingNextPage || (!hasRemotePagination && visibleData.length < orderedData.length);

  return (
    <div className="space-y-4" role="presentation" onKeyDown={handleKeyDown}>
      {!onTableTelemetryChange ? <VirtualTableToolbar telemetry={tableTelemetry} /> : null}
      <div ref={tableContainerRef} className="overflow-hidden rounded-lg border border-border bg-background">
        <VirtualTableHeaderSearch
          placeholder={searchPlaceholder}
          searchValue={draftSearchValue}
          searchTelemetry={searchTelemetry}
          tableContainerRef={tableContainerRef}
          onArrowDown={focusNextRow}
          onArrowUp={focusPreviousRow}
          onEnter={handleSearchEnter}
          onSearchFocus={handleSearchFocus}
          onSearchValueChange={handleSearchValueChange}
          onTabToResults={focusFirstRow}
        />
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
              <SortHeaderButton
                key={String(column.key)}
                columnKey={String(column.key)}
                header={column.header}
                isSorted={isSorted}
                sortDirection={sortDirection}
                headerClassName={column.headerClassName}
                onSort={handleSort}
              />
            );
          })}
        </div>
        <div ref={viewportRef} className="overflow-y-auto" style={{ height: rowHeight * visibleRowCount }}>
          {visibleData.length === 0 ? (
            <div className="flex h-full items-center justify-center px-4 text-sm text-muted-foreground">
              {emptyStateLabel}
            </div>
          ) : (
            <>
              <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
                {virtualItems.map((virtualRow) => {
                  const row = visibleData[virtualRow.index];
                  const rowKey = resolveRowKey(row);
                  const isExpanded = Boolean(renderExpandedRow) && expandedRowKeyString === rowKey;
                  return (
                    <div
                      key={rowKey}
                      ref={(element) => {
                        rowRefs.current[virtualRow.index] = element;
                      }}
                      data-row-index={virtualRow.index}
                      tabIndex={0}
                      onClick={() => triggerRowClick(row)}
                      onFocus={() => setFocusedRowIndex(virtualRow.index)}
                      className={cn('absolute left-0 right-0 border-b border-border bg-background px-4 outline-none', focusedRowIndex === virtualRow.index ? 'bg-muted/50' : undefined, onRowClick ? 'cursor-pointer' : undefined)}
                      style={{
                        height: virtualRow.size,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <div className="flex h-full flex-col">
                        <div className="grid items-center gap-4 hover:bg-muted/20" style={{ gridTemplateColumns, minHeight: rowHeight, height: rowHeight }}>
                          {columns.map((column) => (
                            <div key={String(column.key)} className={cn('min-w-0 truncate text-sm', column.className)}>
                              {column.render ? column.render(row[column.key], row, focusedRowIndex === virtualRow.index) : String(row[column.key] ?? '')}
                            </div>
                          ))}
                        </div>
                        {isExpanded ? (
                          <div
                            className="overflow-hidden border-t border-border bg-muted/20 px-3 py-3"
                            style={{ height: expandedRowHeight }}
                          >
                            {renderExpandedRow?.(row)}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
              {showLoadMoreHint ? (
                <div className="flex items-center justify-center border-t border-border px-4 py-3 text-sm text-muted-foreground">
                  {isFetchingNextPage ? 'Loading more…' : 'Scroll to load more'}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
