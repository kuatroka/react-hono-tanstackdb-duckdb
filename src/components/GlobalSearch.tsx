import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useZero } from "@rocicorp/zero/react";
import { queries } from "@/zero/queries";
import { PRELOAD_TTL } from "@/zero-preload";
import { Input } from "@/components/ui/input";
import { LatencyBadge } from "@/components/LatencyBadge";
import { useLatencyMs } from "@/lib/latency";
import { navigateTo } from "@/lib/navigation";
import { Schema } from "@/schema";
import type { Search } from "@/schema";

const GLOBAL_SEARCH_DEBOUNCE_MS = 120;

type SearchInputKeyAction = "ArrowDown" | "ArrowUp" | "Enter" | "Escape";

interface GlobalSearchInputProps {
  clearSignal: number;
  onQueryCommit: (value: string) => void;
  onKeyAction: (action: SearchInputKeyAction) => void;
}

const GlobalSearchInput = memo(function GlobalSearchInput({
  clearSignal,
  onQueryCommit,
  onKeyAction,
}: GlobalSearchInputProps) {
  const [inputValue, setInputValue] = useState("");
  const hasMountedRef = useRef(false);
  const onQueryCommitRef = useRef(onQueryCommit);
  const onKeyActionRef = useRef(onKeyAction);

  useEffect(() => {
    onQueryCommitRef.current = onQueryCommit;
  }, [onQueryCommit]);

  useEffect(() => {
    onKeyActionRef.current = onKeyAction;
  }, [onKeyAction]);

  useEffect(() => {
    setInputValue("");
    onQueryCommitRef.current("");
  }, [clearSignal]);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    const timeoutId = setTimeout(() => {
      onQueryCommitRef.current(inputValue);
    }, GLOBAL_SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [inputValue]);

  return (
    <Input
      type="search"
      placeholder="Search superinvestors, tickers..."
      value={inputValue}
      onChange={(e) => setInputValue(e.target.value)}
      onKeyDown={(e) => {
        switch (e.key) {
          case "ArrowDown":
          case "ArrowUp":
          case "Enter":
          case "Escape":
            onKeyActionRef.current(e.key);
            break;
          default:
            break;
        }
      }}
      className="w-full sm:w-[30rem]"
    />
  );
});

GlobalSearchInput.displayName = "GlobalSearchInput";

interface GlobalSearchResultsListProps {
  results: Search[];
  highlightedIndex: number;
  onHighlight: (index: number) => void;
  onNavigate: (result: Search) => void;
}

const GlobalSearchResultsList = memo(function GlobalSearchResultsList({
  results,
  highlightedIndex,
  onHighlight,
  onNavigate,
}: GlobalSearchResultsListProps) {
  const z = useZero<Schema>();

  return (
    <div className="absolute z-50 mt-1 w-full sm:w-[30rem] rounded-md border border-border bg-popover shadow-lg">
      {results.map((result, index) => (
        <button
          key={result.id}
          type="button"
          className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted ${
            index === highlightedIndex ? "bg-muted" : ""
          }`}
          onMouseDown={(e) => {
            e.preventDefault();
            onNavigate(result);
          }}
          onMouseEnter={() => {
            onHighlight(index);
            if (result.category === "assets") {
              if (result.cusip) {
                z.preload(queries.assetBySymbolAndCusip(result.code, result.cusip), { ttl: PRELOAD_TTL });
              } else {
                z.preload(queries.assetBySymbol(result.code), { ttl: PRELOAD_TTL });
              }
            } else if (result.category === "superinvestors") {
              z.preload(queries.superinvestorByCik(result.code), { ttl: PRELOAD_TTL });
            }
          }}
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
  );
});

GlobalSearchResultsList.displayName = "GlobalSearchResultsList";

export const GlobalSearch = memo(function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [clearSignal, setClearSignal] = useState(0);
  const resultsRef = useRef<Search[]>([]);
  const highlightedIndexRef = useRef(-1);
  const handleNavigateRef = useRef<(result: Search) => void>(() => {});

  const trimmed = query.trim();
  const shouldSearch = trimmed.length >= 2;

  // Two parallel queries: one for code matches (high priority), one for name matches
  const [codeResults, codeResult] = useQuery(
    queries.searchesByCode(trimmed, 20),
    { enabled: shouldSearch, ttl: PRELOAD_TTL }
  );

  const [nameResults, nameResult] = useQuery(
    queries.searchesByName(trimmed, 30),
    { enabled: shouldSearch, ttl: PRELOAD_TTL }
  );

  const searchReady = Boolean(
    !shouldSearch ||
      (codeResults && nameResults && (codeResults.length > 0 || nameResults.length > 0)) ||
      (codeResult?.type === "complete" && nameResult?.type === "complete")
  );
  const searchLatencyMs = useLatencyMs({
    isReady: searchReady,
    resetKey: shouldSearch ? `globalSearch:${trimmed}` : "globalSearch:idle",
    enabled: shouldSearch,
  });

  // Merge and rank results: code matches first, then name matches, deduplicated
  // Memoize to prevent unnecessary recalculations and effect re-triggers
  const results = useMemo<Search[]>(() => {
    if (!shouldSearch) return [];

    const searchLower = trimmed.toLowerCase();
    const seen = new Set<number>();
    const merged: Search[] = [];

    // Helper to calculate score for sorting
    const getScore = (item: Pick<Search, "code" | "name">) => {
      const codeLower = (item.code || "").toLowerCase();
      const nameLower = (item.name || "").toLowerCase();

      // Highest priority: exact code match
      if (codeLower === searchLower) return 100;
      // Code starts with search term
      if (codeLower.startsWith(searchLower)) return 80;
      // Code contains search term
      if (codeLower.includes(searchLower)) return 60;
      // Name starts with search term
      if (nameLower.startsWith(searchLower)) return 40;
      // Name contains search term
      if (nameLower.includes(searchLower)) return 20;
      return 0;
    };

    // Add code results first (they matched on code)
    for (const item of codeResults || []) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        merged.push(item);
      }
    }

    // Add name results (deduplicated)
    for (const item of nameResults || []) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        merged.push(item);
      }
    }

    // Sort by score descending, then alphabetically by name
    return merged
      .sort((a, b) => {
        const scoreA = getScore(a);
        const scoreB = getScore(b);
        if (scoreA !== scoreB) return scoreB - scoreA;
        return (a.name || "").localeCompare(b.name || "");
      })
      .slice(0, 10);
  }, [shouldSearch, trimmed, codeResults, nameResults]);

  useEffect(() => {
    resultsRef.current = results;
  }, [results]);

  useEffect(() => {
    highlightedIndexRef.current = highlightedIndex;
  }, [highlightedIndex]);

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

  useEffect(() => {
    setIsOpen(shouldSearch && !!results && results.length > 0);
    if (shouldSearch && results && results.length > 0) {
      setHighlightedIndex(0);
    } else {
      setHighlightedIndex(-1);
    }
  }, [shouldSearch, results]);

  const handleQueryCommit = useCallback((value: string) => {
    setQuery(value);
  }, []);

  const handleNavigate = useCallback((result: Search) => {
    setIsOpen(false);
    setQuery("");
    setClearSignal((current) => current + 1);

    if (result.category === "superinvestors") {
      navigateTo(`/superinvestors/${encodeURIComponent(result.code)}`);
    } else if (result.category === "assets") {
      // Include cusip in the URL for assets to handle multiple cusips per ticker
      const cusip = result.cusip || "_";
      navigateTo(`/assets/${encodeURIComponent(result.code)}/${encodeURIComponent(cusip)}`);
    }
  }, []);

  useEffect(() => {
    handleNavigateRef.current = handleNavigate;
  }, [handleNavigate]);

  const handleKeyAction = useCallback((action: SearchInputKeyAction) => {
    if (action === "Escape") {
      setIsOpen(false);
      return;
    }

    const currentResults = resultsRef.current;
    if (!currentResults.length) {
      return;
    }

    if (action === "ArrowDown") {
      setIsOpen(true);
      setHighlightedIndex((prev) => {
        const next = prev < currentResults.length - 1 ? prev + 1 : prev;
        highlightedIndexRef.current = next;
        return next;
      });
      return;
    }

    if (action === "ArrowUp") {
      setIsOpen(true);
      setHighlightedIndex((prev) => {
        const next = prev > 0 ? prev - 1 : prev;
        highlightedIndexRef.current = next;
        return next;
      });
      return;
    }

    if (action === "Enter") {
      const index = highlightedIndexRef.current;
      if (index >= 0 && index < currentResults.length) {
        handleNavigateRef.current(currentResults[index]);
      }
    }
  }, []);

  const handleHighlight = useCallback((index: number) => {
    highlightedIndexRef.current = index;
    setHighlightedIndex(index);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full sm:w-auto">
      <GlobalSearchInput
        clearSignal={clearSignal}
        onQueryCommit={handleQueryCommit}
        onKeyAction={handleKeyAction}
      />
      {shouldSearch && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <LatencyBadge ms={searchLatencyMs} source="Zero: searches.byCode + searches.byName" />
        </div>
      )}
      {isOpen && results.length > 0 && (
        <GlobalSearchResultsList
          results={results}
          highlightedIndex={highlightedIndex}
          onHighlight={handleHighlight}
          onNavigate={handleNavigate}
        />
      )}
    </div>
  );
});

GlobalSearch.displayName = "GlobalSearch";
