import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "@tanstack/react-db";
import { Input } from "@/components/ui/input";
import { LatencyBadge } from "@/components/LatencyBadge";
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

interface SearchResult extends CollectionSearchResult {
  score: number;
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
  const localResults = useMemo(() => {
    if (!shouldSearch) return [];
    const startTime = performance.now();
    
    // Use indexed search if available (sub-ms), otherwise fallback to O(n) filter
    const filtered = isSearchIndexReady()
      ? searchWithIndex(debouncedQuery, 20)
      : filterAndRankResults(allItems, debouncedQuery, 20);
    
    setQueryTimeMs(Math.round((performance.now() - startTime) * 1000) / 1000);
    return filtered;
  }, [allItems, debouncedQuery, shouldSearch]);

  // Load the search index only on explicit user intent (focus / typing)
  // to avoid paying the memory cost on routes where search is never used.
  const indexLoadStartedRef = useRef(false);

  const loadSearchIndex = useCallback(async () => {
    if (indexLoadStartedRef.current) return;
    indexLoadStartedRef.current = true;

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

  // Fallback to API if collection is empty and user is searching
  useEffect(() => {
    if (!shouldSearch) {
      setApiResults([]);
      setIsUsingApi(false);
      return;
    }

    // If we have local data, use it
    if (allItems.length > 0) {
      setIsUsingApi(false);
      return;
    }

    // Only fallback to API if initialized and still no data
    if (!isInitialized) return;

    // Fallback to API while sync is in progress
    setIsUsingApi(true);
    const fetchFromApi = async () => {
      try {
        const result = await fetchDuckDBSearch(debouncedQuery);
        setApiResults(result.results);
        setQueryTimeMs(result.queryTimeMs);
      } catch (error) {
        console.error('[Search] API Error:', error);
        setApiResults([]);
      }
    };

    fetchFromApi();
  }, [debouncedQuery, shouldSearch, allItems.length, isInitialized]);

  // Use local results if available, otherwise API results
  const results = allItems.length > 0 ? localResults : apiResults;
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
        <Input
          type="search"
          placeholder="DuckDB Search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          className="w-full sm:w-[30rem] pr-16"
        />
        {queryTimeMs !== undefined && shouldSearch && !isFetching && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <LatencyBadge
              latencyMs={queryTimeMs}
              source={isUsingApi ? "rq-api" : "tsdb-indexeddb"}
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
          {results.map((result, index) => (
            <button
              key={result.id}
              data-index={index}
              type="button"
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted ${index === highlightedIndex ? "bg-muted" : ""
                }`}
              onMouseDown={(e) => {
                e.preventDefault();
                handleNavigate(result);
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <div className="flex flex-col truncate mr-2">
                {result.category === "assets" ? (
                  <>
                    <span className="truncate">
                      <span className="font-bold">{result.code}</span>
                      {result.name && <span> - {result.name}</span>}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {result.cusip || ""}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="truncate">{result.name || result.code}</span>
                    <span className="text-xs text-muted-foreground">
                      {result.code}
                    </span>
                  </>
                )}
              </div>
              <span className="ml-auto text-xs uppercase text-muted-foreground">
                {result.category}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
