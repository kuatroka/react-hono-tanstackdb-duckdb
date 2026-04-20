import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import UFuzzy from "@leeoniya/ufuzzy";
import { useNavigate } from "@tanstack/react-router";
import { LatencyBadge } from "@/components/LatencyBadge";
import { GlobalSearchInput } from "@/components/global-search/GlobalSearchInput";
import { GlobalSearchResults } from "@/components/global-search/GlobalSearchResults";
import { ensureSearchItemsLoaded, type SearchResult as CollectionSearchResult } from "@/collections/searches";
import { runUFuzzySearch, UFUZZY_OPTIONS, type UFuzzyPreviousFilter } from "@/lib/ufuzzy-search";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

function toHaystackValue(item: CollectionSearchResult) {
  return item.name ? `${item.code} ${item.name}` : item.code;
}

export function UFuzzyGlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [allItems, setAllItems] = useState<CollectionSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [queryTimeMs, setQueryTimeMs] = useState<number | undefined>();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const loadStartedRef = useRef(false);
  const ufuzzyRef = useRef(new UFuzzy(UFUZZY_OPTIONS));
  const previousFilterRef = useRef<UFuzzyPreviousFilter>({
    query: "",
    idxs: null,
  });

  const debouncedQuery = useDebounce(query.trim(), 50);
  const shouldSearch = debouncedQuery.length >= 2;

  const haystack = useMemo(() => allItems.map(toHaystackValue), [allItems]);

  const loadSearchItems = useCallback(async () => {
    if (loadStartedRef.current) return;
    loadStartedRef.current = true;
    setIsLoading(true);

    try {
      setAllItems(await ensureSearchItemsLoaded());
    } catch (error) {
      console.error("[uFuzzy Search] Failed to load search items:", error);
      loadStartedRef.current = false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (shouldSearch && !loadStartedRef.current) {
      void loadSearchItems();
    }
  }, [loadSearchItems, shouldSearch]);

  useEffect(() => {
    if (!shouldSearch) {
      previousFilterRef.current = { query: "", idxs: null };
      setQueryTimeMs(undefined);
    }
  }, [shouldSearch]);

  const searchMetrics = useMemo(() => {
    const metrics = runUFuzzySearch(
      ufuzzyRef.current,
      haystack,
      allItems,
      debouncedQuery,
      previousFilterRef.current,
    );

    previousFilterRef.current = {
      query: debouncedQuery,
      idxs: metrics.idxs,
    };

    return {
      results: metrics.results,
      latencyMs: metrics.latencyMs,
    };
  }, [allItems, debouncedQuery, haystack]);

  useEffect(() => {
    setQueryTimeMs(searchMetrics.latencyMs);
  }, [searchMetrics.latencyMs]);

  const results = searchMetrics.results;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const hasResults = results.length > 0;
    setIsOpen(shouldSearch && (hasResults || isLoading));
    if (shouldSearch && hasResults) {
      setHighlightedIndex(0);
    } else if (!isLoading) {
      setHighlightedIndex(-1);
    }
  }, [isLoading, results, shouldSearch]);

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

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (event.key === "Enter") {
      if (highlightedIndex >= 0 && highlightedIndex < results.length) {
        event.preventDefault();
        handleNavigate(results[highlightedIndex]);
      }
    } else if (event.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full sm:w-auto">
      <div className="flex flex-col gap-1 min-w-0">
        <div className="relative">
          <GlobalSearchInput
            query={query}
            onChange={setQuery}
            onKeyDown={handleKeyDown}
            className="w-full sm:w-[18rem] lg:w-[20rem] xl:w-[22rem]"
          />
          {queryTimeMs !== undefined && shouldSearch && !isLoading ? (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <LatencyBadge latencyMs={queryTimeMs} source="memory" label="search" />
            </div>
          ) : null}
          {isLoading ? (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
              ...
            </span>
          ) : null}
        </div>
      </div>
      {isOpen && results.length > 0 ? (
        <div ref={listRef} className="absolute z-50 mt-1 w-full sm:w-[30rem] max-h-[400px] overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
          <GlobalSearchResults
            results={results}
            highlightedIndex={highlightedIndex}
            onHover={setHighlightedIndex}
            onSelect={handleNavigate}
          />
        </div>
      ) : null}
    </div>
  );
}
