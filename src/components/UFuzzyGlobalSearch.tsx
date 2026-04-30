import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import UFuzzy from "@leeoniya/ufuzzy";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { LatencyBadge } from "@/components/LatencyBadge";
import { GlobalSearchInput } from "@/components/global-search/GlobalSearchInput";
import { GlobalSearchResults } from "@/components/global-search/GlobalSearchResults";
import type { SearchResult } from "@/components/global-search/search-result";
import {
  ensureSearchIndexLoaded,
  getLoadedSearchIndex,
} from "@/collections/searches";
import { cn } from "@/lib/utils";
import { runUFuzzySearch, UFUZZY_OPTIONS, type UFuzzyPreviousFilter } from "@/lib/ufuzzy-search";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

interface UFuzzyGlobalSearchProps {
  mode?: "desktop" | "mobile-drawer";
  className?: string;
  placeholder?: string;
  onNavigate?: () => void;
}

export function UFuzzyGlobalSearch({
  mode = "desktop",
  className,
  placeholder = "Search superinvestors, tickers...",
  onNavigate,
}: UFuzzyGlobalSearchProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [searchIndex, setSearchIndex] = useState(() => getLoadedSearchIndex());
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [queryTimeMs, setQueryTimeMs] = useState<number | undefined>();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const loadStartedRef = useRef(false);
  const ufuzzyRef = useRef(new UFuzzy(UFUZZY_OPTIONS));
  const previousFilterRef = useRef<UFuzzyPreviousFilter>({
    query: "",
    idxs: null,
  });

  const debouncedQuery = useDebounce(query.trim(), 50);
  const shouldSearch = debouncedQuery.length >= 2;

  const loadSearchItems = useCallback(async () => {
    if (loadStartedRef.current) return;
    loadStartedRef.current = true;
    setIsLoading(true);

    try {
      setSearchIndex(await ensureSearchIndexLoaded());
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
      searchIndex.haystack,
      searchIndex.items,
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
  }, [debouncedQuery, searchIndex]);

  useEffect(() => {
    setQueryTimeMs(searchMetrics.latencyMs);
  }, [searchMetrics.latencyMs]);

  const results = searchMetrics.results;
  const isMobileDrawer = mode === "mobile-drawer";
  const showResults = isOpen && (results.length > 0 || (shouldSearch && !isLoading));

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
    if (!isMobileDrawer) return;
    if (!containerRef.current) return;

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isMobileDrawer]);

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
    setHighlightedIndex(-1);
    onNavigate?.();

    if (result.category === "superinvestors") {
      navigate({ to: `/superinvestors/${encodeURIComponent(result.code)}` });
    } else if (result.category === "assets") {
      const cusip = result.cusip || "_";
      navigate({ to: `/assets/${encodeURIComponent(result.code)}/${encodeURIComponent(cusip)}` });
    }
  };

  const clearSearch = () => {
    setQuery("");
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      clearSearch();
      return;
    }

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
    }
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="relative">
          <Search className={cn(
            "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground",
            isMobileDrawer ? "size-4.5 text-foreground/70" : undefined,
          )} />
          <GlobalSearchInput
            id={isMobileDrawer ? "global-search-mobile" : "global-search"}
            name={isMobileDrawer ? "global-search-mobile" : "global-search"}
            query={query}
            onChange={setQuery}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            ref={inputRef}
            className={cn(
              "w-full pl-10 pr-16",
              isMobileDrawer
                ? "h-12 rounded-xl border-border/80 bg-background text-[15px] shadow-none"
                : "h-10 rounded-md border-border/80 bg-background/90 text-sm shadow-sm md:w-[18rem] lg:w-[20rem] xl:w-[22rem]",
            )}
          />
          {queryTimeMs !== undefined && shouldSearch && !isLoading ? (
            <div className={cn(
              "absolute top-1/2 -translate-y-1/2",
              isMobileDrawer ? "right-3" : "right-2",
            )}>
              <LatencyBadge latencyMs={queryTimeMs} source="memory" label="search" />
            </div>
          ) : null}
          {isLoading ? (
            <span className={cn(
              "absolute top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground",
              isMobileDrawer ? "right-4" : "right-2",
            )}>
              ...
            </span>
          ) : null}
        </div>
      </div>
      {showResults ? (
        <div
          ref={listRef}
          className={cn(
            "z-50 overflow-y-auto border border-border bg-popover shadow-lg",
            isMobileDrawer
              ? "mt-3 max-h-[min(50vh,26rem)] rounded-2xl"
              : "absolute mt-1 max-h-[400px] w-full rounded-md sm:w-[30rem]",
          )}
        >
          {results.length > 0 ? (
            <GlobalSearchResults
              results={results}
              highlightedIndex={highlightedIndex}
              onHover={setHighlightedIndex}
              onSelect={handleNavigate}
            />
          ) : (
            <div className="px-4 py-3 text-sm text-muted-foreground">Type at least 2 characters to search.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
