import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "@tanstack/react-db";
import { LatencyBadge } from "@/components/LatencyBadge";
import { GlobalSearchInput } from "@/components/global-search/GlobalSearchInput";
import { GlobalSearchResults } from "@/components/global-search/GlobalSearchResults";
import type { SearchResult } from "@/components/global-search/search-result";
import { searchesCollection, preloadSearches, getSyncState, buildSearchIndex, searchWithIndex, isSearchIndexReady, loadPrecomputedIndex } from "@/collections/searches";
import type { SearchResult as CollectionSearchResult } from "@/collections/searches";

// 50ms debounce for near-instant feel while reducing request volume
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

interface SearchResponse {
  results: SearchResult[];
  count: number;
  queryTimeMs: number;
}

// Local filtering and ranking logic matching DuckDB scoring
function scoreSearchResult(item: CollectionSearchResult, query: string): number {
  if (!item || !item.code) return 0;
  const lowerQuery = query.toLowerCase();
  const lowerCode = item.code.toLowerCase();
  const lowerName = (item.name || "").toLowerCase();

  if (lowerCode === lowerQuery) return 100;
  if (lowerCode.startsWith(lowerQuery)) return 80;
  if (lowerCode.includes(lowerQuery)) return 60;
  if (lowerName.startsWith(lowerQuery)) return 40;
  if (lowerName.includes(lowerQuery)) return 20;
  return 0;
}

function filterAndRankResults(
  allResults: CollectionSearchResult[],
  query: string,
  limit: number = 20
): SearchResult[] {
  if (!allResults || !Array.isArray(allResults)) return [];
  
  const scored = allResults
    .filter((item) => item && item.code) // Filter out invalid items
    .map((item) => ({
      ...item,
      score: scoreSearchResult(item, query),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || (a.name || "").localeCompare(b.name || ""))
    .slice(0, limit);

  return scored;
}

async function fetchDuckDBSearch(query: string): Promise<SearchResponse> {
  const res = await fetch(`/api/duckdb-search?q=${encodeURIComponent(query)}&limit=20`);
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}

export function DuckDBGlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [queryTimeMs, setQueryTimeMs] = useState<number | undefined>();
  const [isUsingApi, setIsUsingApi] = useState(false);
  const [apiResults, setApiResults] = useState<SearchResult[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const apiRequestSequenceRef = useRef(0);

  // 50ms debounce
  const debouncedQuery = useDebounce(query.trim(), 50);
  const shouldSearch = debouncedQuery.length >= 2;

  // Use TanStack DB live query for reactive local search
  // Pattern matches AssetsTable.tsx - no .select() needed
  const { data: searchData } = useLiveQuery(
    (q) => q.from({ searches: searchesCollection })
  );

  // Get all items from the collection
  const allItems = useMemo(() => {
    return (searchData ?? []) as CollectionSearchResult[];
  }, [searchData]);

  // Build search index when data is available (one-time operation)
  const indexBuiltRef = useRef(false);
  useEffect(() => {
    if (allItems.length > 0 && !indexBuiltRef.current) {
      indexBuiltRef.current = true;
      buildSearchIndex(allItems);
    }
  }, [allItems]);

  // Filter and rank results using indexed search (sub-ms) or fallback to O(n) filter
  const localSearchMetrics = useMemo(() => {
    if (!shouldSearch) {
      return { results: [] as SearchResult[], latencyMs: undefined as number | undefined };
    }

    const startedAt = performance.now();
    const results = isSearchIndexReady()
      ? searchWithIndex(debouncedQuery, 20)
      : filterAndRankResults(allItems, debouncedQuery, 20);

    return {
      results,
      latencyMs: Math.round((performance.now() - startedAt) * 1000) / 1000,
    };
  }, [allItems, debouncedQuery, shouldSearch]);

  useEffect(() => {
    setQueryTimeMs(localSearchMetrics.latencyMs);
  }, [localSearchMetrics.latencyMs]);

  // Load the search index only on explicit user intent (focus / typing)
  // to avoid paying the memory cost on routes where search is never used.
  const indexLoadStartedRef = useRef(false);

  const loadSearchIndex = useCallback(async () => {
    if (indexLoadStartedRef.current) return;
    indexLoadStartedRef.current = true;

    try {
      // 1. Try to load pre-computed index from IndexedDB/API
      console.log('[Search] Loading search index...');
      await loadPrecomputedIndex();

      // 2. If pre-computed index loaded, we're done – skip the heavy
      //    searches collection preload (56K items) to save ~50 MB of heap.
      if (isSearchIndexReady()) {
        console.log('[Search] Search index loaded successfully');
        setIsInitialized(true);
        return;
      }

      // 3. Fallback: load via TanStack DB full-dump cursor pagination
      console.log('[Search] Fallback to full-dump sync...');
      const syncState = getSyncState();
      if (syncState.status !== 'complete') {
        await preloadSearches();
      }
      setIsInitialized(true);
    } catch (error) {
      console.error('[Search] Search index load failed:', error);
      indexLoadStartedRef.current = false;
      setIsInitialized(true);
    }
  }, []);

  // Load immediately once the user starts searching.
  useEffect(() => {
    if (shouldSearch && !indexLoadStartedRef.current) {
      void loadSearchIndex();
    }
  }, [shouldSearch, loadSearchIndex]);

  const handleFocus = useCallback(() => {
    if (!indexLoadStartedRef.current) {
      void loadSearchIndex();
    }
  }, [loadSearchIndex]);

  const hasLocalSearchAuthority = isSearchIndexReady() || allItems.length > 0;

  // Fallback to API only when no local search source is available yet
  useEffect(() => {
    if (!shouldSearch) {
      apiRequestSequenceRef.current += 1;
      setApiResults([]);
      setIsUsingApi(false);
      return;
    }

    if (hasLocalSearchAuthority) {
      apiRequestSequenceRef.current += 1;
      setIsUsingApi(false);
      return;
    }

    // Only fallback to API if initialized and still no local authority
    if (!isInitialized) return;

    setIsUsingApi(true);
    const requestId = ++apiRequestSequenceRef.current;
    const fetchFromApi = async () => {
      try {
        const result = await fetchDuckDBSearch(debouncedQuery);
        if (requestId !== apiRequestSequenceRef.current) return;
        setApiResults(result.results);
        setQueryTimeMs(result.queryTimeMs);
      } catch (error) {
        if (requestId !== apiRequestSequenceRef.current) return;
        console.error('[Search] API Error:', error);
        setApiResults([]);
      }
    };

    fetchFromApi();
  }, [debouncedQuery, shouldSearch, hasLocalSearchAuthority, isInitialized]);

  const hasLocalResults = localSearchMetrics.results.length > 0;
  const results = hasLocalResults ? localSearchMetrics.results : (hasLocalSearchAuthority ? localSearchMetrics.results : apiResults);
  const isFetching = isUsingApi && apiResults.length === 0 && shouldSearch;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Open dropdown when results arrive or while fetching; avoid closing during fetch to prevent flash
  useEffect(() => {
    const hasResults = results.length > 0;
    setIsOpen(shouldSearch && (hasResults || isFetching));
    if (shouldSearch && hasResults) {
      setHighlightedIndex(0);
    } else if (!isFetching) {
      setHighlightedIndex(-1);
    }
  }, [shouldSearch, results, isFetching]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex < 0 || !listRef.current) return;
    const item = listRef.current.querySelector(`[data-index="${highlightedIndex}"]`);
    if (item) {
      item.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [highlightedIndex]);

  const handleNavigate = (result: SearchResult) => {
    setIsOpen(false);
    setQuery("");

    if (result.category === "superinvestors") {
      navigate({ to: `/superinvestors/${encodeURIComponent(result.code)}` });
    } else if (result.category === "assets") {
      const cusip = result.cusip || "_";
      navigate({ to: `/assets/${encodeURIComponent(result.code)}/${encodeURIComponent(cusip)}` });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((prev) =>
        prev < results.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === "Enter") {
      if (highlightedIndex >= 0 && highlightedIndex < results.length) {
        e.preventDefault();
        handleNavigate(results[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full sm:w-auto">
      <div className="relative">
        <GlobalSearchInput
          query={query}
          onChange={setQuery}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
        />
        {queryTimeMs !== undefined && shouldSearch && !isFetching && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <LatencyBadge
              latencyMs={queryTimeMs}
              source={isUsingApi ? "api-duckdb" : "tsdb-indexeddb"}
            />
          </div>
        )}
        {isFetching && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
            ...
          </span>
        )}
      </div>
      {isOpen && results.length > 0 && (
        <div ref={listRef} className="absolute z-50 mt-1 w-full sm:w-[30rem] max-h-[400px] overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
          <GlobalSearchResults
            results={results}
            highlightedIndex={highlightedIndex}
            onHover={setHighlightedIndex}
            onSelect={handleNavigate}
          />
        </div>
      )}
    </div>
  );
}
