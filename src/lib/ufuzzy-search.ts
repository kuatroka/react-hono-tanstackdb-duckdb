import UFuzzy from "@leeoniya/ufuzzy";
import type { SearchResult } from "@/components/global-search/search-result";
import type { SearchResult as CollectionSearchResult } from "@/collections/searches";

export const UFUZZY_OPTIONS = {
  intraMode: 1,
  intraIns: 1,
  interIns: 2,
} as const;

export interface UFuzzyPreviousFilter {
  query: string;
  idxs: number[] | null;
  haystackSize?: number;
}

export function runUFuzzyIndexSearch(
  ufuzzy: Pick<UFuzzy, "filter" | "info" | "sort">,
  haystack: string[],
  query: string,
  previous: UFuzzyPreviousFilter,
) {
  if (query.length < 2 || haystack.length === 0) {
    return {
      idxs: null,
      rankedIndexes: [] as number[],
      latencyMs: undefined as number | undefined,
    };
  }

  const preFiltered = previous.idxs
    && previous.idxs.length > 0
    && query.startsWith(previous.query)
    && (previous.haystackSize == null || previous.haystackSize === haystack.length)
    ? previous.idxs
    : undefined;

  const startedAt = performance.now();
  const idxs = ufuzzy.filter(haystack, query, preFiltered);
  const latencyMs = Math.round((performance.now() - startedAt) * 1000) / 1000;

  if (!idxs || idxs.length === 0) {
    return {
      idxs,
      rankedIndexes: [] as number[],
      latencyMs,
    };
  }

  const rankedIndexes = idxs.length <= 1e3
    ? (() => {
        const info = ufuzzy.info(idxs, haystack, query);
        const order = ufuzzy.sort(info, haystack, query);
        return order.map((infoIndex) => info.idx[infoIndex]);
      })()
    : idxs;

  return {
    idxs,
    rankedIndexes,
    latencyMs,
  };
}

function collectTickerPriorityMatches(
  allItems: CollectionSearchResult[],
  query: string,
  limit: number,
) {
  const lowerQuery = query.toLowerCase();
  const exactMatches: SearchResult[] = [];
  const prefixMatches: SearchResult[] = [];

  for (const item of allItems) {
    const lowerCode = item.code.toLowerCase();

    if (lowerCode === lowerQuery) {
      exactMatches.push(item);
      continue;
    }

    if (lowerCode.startsWith(lowerQuery)) {
      prefixMatches.push(item);
    }
  }

  return [...exactMatches, ...prefixMatches]
    .sort((left, right) => left.code.localeCompare(right.code) || (left.name || "").localeCompare(right.name || ""))
    .slice(0, limit);
}

function getWordPrefixMatchScore(lowerName: string, lowerQuery: string) {
  if (!lowerName || !lowerQuery) return 0;
  const words = lowerName.split(/[\s/|,;:()_-]+/);
  return words.some((word) => word.startsWith(lowerQuery)) ? 1 : 0;
}

export function rerankUFuzzyResults(
  results: SearchResult[],
  query: string,
) {
  const lowerQuery = query.toLowerCase();

  return [...results]
    .map((result, originalIndex) => {
      const lowerCode = result.code.toLowerCase();
      const lowerName = (result.name || "").toLowerCase();

      let score = results.length - originalIndex;

      if (lowerCode === lowerQuery) score += 1000;
      else if (lowerCode.startsWith(lowerQuery)) score += 500;
      else if (lowerCode.includes(lowerQuery)) score += 200;

      if (lowerName === lowerQuery) score += 150;
      else if (lowerName.startsWith(lowerQuery)) score += 100;
      else if (getWordPrefixMatchScore(lowerName, lowerQuery)) score += 80;
      else if (lowerName.includes(lowerQuery)) score += 40;

      return {
        ...result,
        score,
      };
    })
    .sort((left, right) => right.score - left.score || (left.name || left.code).localeCompare(right.name || right.code));
}

export function runUFuzzySearch(
  ufuzzy: Pick<UFuzzy, "filter" | "info" | "sort">,
  haystack: string[],
  allItems: CollectionSearchResult[],
  query: string,
  previous: UFuzzyPreviousFilter,
  limit: number = 20,
) {
  const { idxs, rankedIndexes, latencyMs } = runUFuzzyIndexSearch(
    ufuzzy,
    haystack,
    query,
    previous,
  );

  if (rankedIndexes.length === 0) {
    return {
      idxs,
      results: [] as SearchResult[],
      latencyMs,
    };
  }

  const fuzzyCandidates = rankedIndexes.slice(0, Math.max(limit, 250)).map((itemIndex, rank) => ({
    ...allItems[itemIndex],
    score: rankedIndexes.length - rank,
  }));
  const injectedTickerMatches = collectTickerPriorityMatches(allItems, query, Math.max(limit, 25));
  const candidateResults = Array.from(
    new Map(
      [...injectedTickerMatches, ...fuzzyCandidates].map((item) => [item.id, item]),
    ).values(),
  );

  return {
    idxs,
    results: rerankUFuzzyResults(candidateResults, query).slice(0, limit),
    latencyMs,
  };
}
