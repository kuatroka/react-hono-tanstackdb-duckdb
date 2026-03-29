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
          className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted ${index === highlightedIndex ? "bg-muted" : ""}`}
          onMouseDown={(event) => {
            event.preventDefault();
            onSelect(result);
          }}
          onMouseEnter={() => onHover(index)}
        >
          <div className="flex flex-col truncate mr-2">
            {result.category === "assets" ? (
              <>
                <span className="truncate">
                  <span className="font-bold">{result.code}</span>
                  {result.name && <span> - {result.name}</span>}
                </span>
                <span className="text-xs text-muted-foreground">{result.cusip || ""}</span>
              </>
            ) : (
              <>
                <span className="truncate">{result.name || result.code}</span>
                <span className="text-xs text-muted-foreground">{result.code}</span>
              </>
            )}
          </div>
          <span className="ml-auto text-xs uppercase text-muted-foreground">{result.category}</span>
        </button>
      ))}
    </>
  );
});
