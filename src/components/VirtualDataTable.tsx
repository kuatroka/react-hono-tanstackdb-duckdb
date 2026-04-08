import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type Key, type ReactNode } from 'react';
import { LatencyBadge } from '@/components/LatencyBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLatencyMs } from '@/lib/latency';
import { createLegacyPerfTelemetry, type PerfSource, type PerfTelemetry } from '@/lib/perf/telemetry';
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

function VirtualTableToolbar({ telemetry }: VirtualTableToolbarProps) {
  if (!telemetry) {
    return null;
  }

  return (
    <div className="flex items-center justify-end">
      <LatencyBadge telemetry={telemetry} />
    </div>
  );
}

interface VirtualTableHeaderSearchProps {
  placeholder: string;
  searchValue: string;
  tableContainerRef: React.RefObject<HTMLDivElement | null>;
  onArrowDown: () => void;
  onArrowUp: () => void;
  onEnter: () => void;
  onSearchFocus: () => void;
  onSearchValueChange: (value: string) => void;
  onTabToResults: () => void;
}

function VirtualTableHeaderSearch({
  placeholder,
  searchValue,
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
    if (isExpanded && searchValue.trim()) {
      onSearchValueChange('');
      return;
    }
    setIsExpanded((current) => !current);
  }, [isExpanded, onSearchValueChange, searchValue]);

  return (
    <div className="flex items-center justify-end border-b border-border bg-background px-4 py-2">
      <div className="flex items-center gap-2">
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
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleToggle}
          className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
          aria-label={isExpanded ? 'Collapse search' : 'Expand search'}
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

interface VirtualDataTableProps<T extends { id: number | string }> {
  data: T[];
  columns: ColumnDef<T>[];
  defaultSortColumn: Extract<keyof T, string>;
  defaultSortDirection?: SortDirection;
  emptyStateLabel?: string;
  getRowKey?: (row: T) => Key;
  gridTemplateColumns: string;
  latencySource?: PerfSource;
  onReady?: () => void;
  dataSource?: PerfSource;
  onSearchChange?: (value: string) => void;
  onSearchTelemetryChange?: (searchTelemetry: PerfTelemetry | null) => void;
  onTableTelemetryChange?: (tableTelemetry: PerfTelemetry | null) => void;
  rowHeight?: number;
  searchDebounceMs?: number;
  searchPlaceholder?: string;
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
  latencySource = 'tsdb-memory',
  onReady,
  dataSource,
  onSearchChange,
  onSearchTelemetryChange,
  onTableTelemetryChange,
  rowHeight = DEFAULT_ROW_HEIGHT,
  searchDebounceMs = 150,
  searchPlaceholder = 'Search...',
  searchTelemetryLabel = 'search',
  searchValue,
  tableTelemetryLabel = 'virtual table',
  visibleRowCount = DEFAULT_VISIBLE_ROW_COUNT,
}: VirtualDataTableProps<T>) {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Array<HTMLDivElement | null>>([]);
  const readyCalledRef = useRef(false);
  const [internalSearchValue, setInternalSearchValue] = useState(searchValue ?? '');
  const [committedSearch, setCommittedSearch] = useState((searchValue ?? '').trim());
  const [sortColumn, setSortColumn] = useState<Extract<keyof T, string>>(defaultSortColumn);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultSortDirection);
  const [focusedRowIndex, setFocusedRowIndex] = useState(-1);
  const [isTableReady, setIsTableReady] = useState(false);
  const isSearchControlled = searchValue !== undefined;
  const resolvedSearchValue = isSearchControlled ? searchValue : internalSearchValue;

  useEffect(() => {
    if (!isSearchControlled) {
      return;
    }
    setInternalSearchValue(searchValue ?? '');
  }, [isSearchControlled, searchValue]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCommittedSearch((resolvedSearchValue ?? '').trim());
    }, searchDebounceMs);

    return () => clearTimeout(timeoutId);
  }, [resolvedSearchValue, searchDebounceMs]);

  useEffect(() => {
    setFocusedRowIndex(-1);
  }, [committedSearch, sortColumn, sortDirection]);

  const searchableColumns = useMemo(
    () => columns.filter((column) => column.searchable),
    [columns],
  );

  const filteredData = useMemo(() => {
    if (!committedSearch) return data;
    const query = committedSearch.toLowerCase();
    return data.filter((row) =>
      searchableColumns.some((column) => {
        const value = row[column.key];
        if (value == null) return false;
        return String(value).toLowerCase().includes(query);
      }),
    );
  }, [committedSearch, data, searchableColumns]);

  const hasSearch = committedSearch.length > 0;
  const shouldReorderRows = hasSearch || sortColumn !== defaultSortColumn || sortDirection !== defaultSortDirection;
  const orderedData = useMemo(() => {
    if (!shouldReorderRows) {
      return filteredData;
    }

    const sorted = [...filteredData];
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
  }, [defaultSortColumn, defaultSortDirection, filteredData, hasSearch, shouldReorderRows, sortColumn, sortDirection]);

  const tableLatencyResetKey = `${String(sortColumn)}:${sortDirection}:${data.length}:${shouldReorderRows}`;
  const searchLatencyResetKey = committedSearch;
  const readyResetKey = `${tableLatencyResetKey}:${searchLatencyResetKey}:${orderedData.length}`;

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
    enabled: Boolean(latencySource && committedSearch),
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
    if (!latencySource || !committedSearch || searchLatencyMs == null) {
      return null;
    }

    return createLegacyPerfTelemetry({
      label: searchTelemetryLabel,
      ms: searchLatencyMs,
      source: dataSource ?? latencySource,
    });
  }, [committedSearch, dataSource, latencySource, searchLatencyMs, searchTelemetryLabel]);

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

  const virtualizer = useVirtualizer({
    count: orderedData.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => rowHeight,
    overscan: 8,
  });

  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    if (focusedRowIndex < 0) return;
    rowRefs.current[focusedRowIndex]?.focus();
  }, [focusedRowIndex, virtualItems]);

  const handleSearchValueChange = useCallback((value: string) => {
    if (!isSearchControlled) {
      setInternalSearchValue(value);
    }
    onSearchChange?.(value);
  }, [isSearchControlled, onSearchChange]);

  const handleSort = useCallback((column: Extract<keyof T, string>) => {
    if (column === sortColumn) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortColumn(column);
    setSortDirection('asc');
  }, [sortColumn]);

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

  const activateFocusedRow = useCallback(() => {
    const activeElement = document.activeElement;
    const link = activeElement?.querySelector?.('a') ?? activeElement?.closest?.('a');
    if (link instanceof HTMLAnchorElement) {
      link.click();
    }
  }, []);

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

  return (
    <div className="space-y-4" onKeyDown={handleKeyDown}>
      {!onTableTelemetryChange ? <VirtualTableToolbar telemetry={tableTelemetry} /> : null}
      <div ref={tableContainerRef} className="overflow-hidden rounded-lg border border-border bg-background">
        <VirtualTableHeaderSearch
          placeholder={searchPlaceholder}
          searchValue={resolvedSearchValue ?? ''}
          tableContainerRef={tableContainerRef}
          onArrowDown={focusNextRow}
          onArrowUp={focusPreviousRow}
          onEnter={() => {
            focusFirstRow();
            focusRowElement(0);
            activateRowElement(0);
          }}
          onSearchFocus={() => setFocusedRowIndex(-1)}
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
              <button
                key={String(column.key)}
                type="button"
                onClick={() => handleSort(column.key)}
                className={cn('flex min-w-0 items-center gap-2 truncate text-left transition-colors hover:text-foreground', column.headerClassName)}
              >
                <span className="truncate">{column.header}</span>
                {isSorted ? sortDirection === 'asc' ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" /> : null}
              </button>
            );
          })}
        </div>
        <div ref={viewportRef} className="overflow-y-auto" style={{ height: rowHeight * visibleRowCount }}>
          {orderedData.length === 0 ? (
            <div className="flex h-full items-center justify-center px-4 text-sm text-muted-foreground">
              {emptyStateLabel}
            </div>
          ) : (
            <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
              {virtualItems.map((virtualRow) => {
                const row = orderedData[virtualRow.index];
                const rowKey = getRowKey ? getRowKey(row) : row.id;
                return (
                  <div
                    key={String(rowKey)}
                    ref={(element) => {
                      rowRefs.current[virtualRow.index] = element;
                    }}
                    data-row-index={virtualRow.index}
                    tabIndex={0}
                    onFocus={() => setFocusedRowIndex(virtualRow.index)}
                    className={cn('absolute left-0 right-0 border-b border-border bg-background px-4 outline-none', focusedRowIndex === virtualRow.index ? 'bg-muted/50' : undefined)}
                    style={{
                      height: rowHeight,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div className="grid h-full items-center gap-4 hover:bg-muted/20" style={{ gridTemplateColumns }}>
                      {columns.map((column) => (
                        <div key={String(column.key)} className={cn('min-w-0 truncate text-sm', column.className)}>
                          {column.render ? column.render(row[column.key], row, focusedRowIndex === virtualRow.index) : String(row[column.key] ?? '')}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
