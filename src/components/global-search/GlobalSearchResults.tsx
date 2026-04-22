import { memo } from "react";
import type { SearchResult } from "@/components/global-search/search-result";

interface GlobalSearchResultsProps {
  results: SearchResult[];
  highlightedIndex: number;
  onHover: (index: number) => void;
  onSelect: (result: SearchResult) => void;
}

export const GlobalSearchResults = memo(function GlobalSearchResults({
  results,
  highlightedIndex,
  onHover,
  onSelect,
}: GlobalSearchResultsProps) {
  return (
    <>
      {results.map((result, index) => (
        <button
          key={result.id}
          data-index={index}
          type="button"
          className={`flex w-full items-center justify-between gap-3 border-b border-border/60 px-4 py-3 text-left text-sm transition-colors last:border-b-0 hover:bg-muted/70 ${index === highlightedIndex ? "bg-muted/80" : "bg-transparent"}`}
          onMouseDown={(event) => {
            event.preventDefault();
            onSelect(result);
          }}
          onMouseEnter={() => onHover(index)}
        >
          <div className="min-w-0 flex-1 space-y-1">
            {result.category === "assets" ? (
              <>
                <span className="block truncate text-sm font-semibold text-foreground">
                  <span>{result.code}</span>
                  {result.name ? <span className="font-normal text-muted-foreground"> · {result.name}</span> : null}
                </span>
                <span className="block truncate text-xs uppercase tracking-[0.12em] text-muted-foreground">{result.cusip || "Asset"}</span>
              </>
            ) : (
              <>
                <span className="block truncate text-sm font-semibold text-foreground">{result.name || result.code}</span>
                <span className="block truncate text-xs uppercase tracking-[0.12em] text-muted-foreground">{result.code}</span>
              </>
            )}
          </div>
          <span className="shrink-0 rounded-full border border-border/80 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {result.category === "assets" ? "Asset" : "Investor"}
          </span>
        </button>
      ))}
    </>
  );
});
