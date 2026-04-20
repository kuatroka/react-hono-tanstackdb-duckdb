import { describe, expect, test } from "bun:test";
import UFuzzy from "@leeoniya/ufuzzy";
import { rerankUFuzzyResults, runUFuzzySearch, UFUZZY_OPTIONS } from "@/lib/ufuzzy-search";
import type { SearchResult as CollectionSearchResult } from "@/collections/searches";

const items: CollectionSearchResult[] = [
  { id: 1, cusip: null, code: "AAPL", name: "Apple Inc", category: "assets" },
  { id: 2, cusip: null, code: "AAPL34", name: "Apple ADR", category: "assets" },
  { id: 3, cusip: null, code: "MSFT", name: "Microsoft", category: "assets" },
];

const haystack = items.map((item) => item.name ? `${item.code} ${item.name}` : item.code);

describe("runUFuzzySearch", () => {
  test("reuses prefix-filtered matches without crashing when the query narrows", () => {
    const ufuzzy = {
      filter: (_haystack: string[], query: string, preFiltered?: number[] | null) => {
        if (query === "aa") return [0, 1];
        expect(preFiltered).toEqual([0, 1]);
        return [0, 1];
      },
      info: (idxs: number[]) => ({ idx: idxs }),
      sort: () => [1, 0],
    };

    const metrics = runUFuzzySearch(ufuzzy, haystack, items, "aap", { query: "aa", idxs: [0, 1] });

    expect(metrics.results.map((result) => result.code)).toEqual(["AAPL", "AAPL34"]);
    expect(metrics.idxs).toEqual([0, 1]);
  });

  test("returns empty results for too-short queries", () => {
    const ufuzzy = {
      filter: () => {
        throw new Error("should not run");
      },
      info: () => ({ idx: [] as number[] }),
      sort: () => [] as number[],
    };

    const metrics = runUFuzzySearch(ufuzzy, haystack, items, "a", { query: "", idxs: null });

    expect(metrics.results).toEqual([]);
    expect(metrics.idxs).toBeNull();
    expect(metrics.latencyMs).toBeUndefined();
  });

  test("does not reuse an empty previous filter when the current query broadens to a valid single-error match", () => {
    const realUFuzzy = new UFuzzy(UFUZZY_OPTIONS);
    const typoHaystack = ["BERKSHIRE HATHAWAY INC | 1067983"];
    const typoItems: CollectionSearchResult[] = [
      { id: 1067983, cusip: null, code: "1067983", name: "BERKSHIRE HATHAWAY INC", category: "superinvestors" },
    ];

    const metrics = runUFuzzySearch(realUFuzzy, typoHaystack, typoItems, "hatway", { query: "hatw", idxs: [] });

    expect(metrics.results.map((result) => result.name)).toEqual(["BERKSHIRE HATHAWAY INC"]);
    expect(metrics.idxs).toEqual([0]);
  });

  test("uses the same tuned uFuzzy options as the example codebase for single-error matching", () => {
    expect(UFUZZY_OPTIONS).toEqual({
      intraMode: 1,
      intraIns: 1,
      interIns: 2,
    });

    const realUFuzzy = new UFuzzy(UFUZZY_OPTIONS);
    expect(realUFuzzy.filter(["Berkshire Hathaway"], "hatway")).toEqual([0]);
  });

  test("reranks exact ticker matches ahead of looser fuzzy matches", () => {
    const reranked = rerankUFuzzyResults([
      { id: 2, cusip: null, code: "AAPW", name: "Apple Weekly", category: "assets", score: 10 },
      { id: 1, cusip: null, code: "AAPL", name: "Apple Inc", category: "assets", score: 9 },
    ], "AAPL");

    expect(reranked[0]?.code).toBe("AAPL");
  });

  test("gives word-prefix name matches a boost for name queries", () => {
    const reranked = rerankUFuzzyResults([
      { id: 1, cusip: null, code: "1067983", name: "BERKSHIRE HATHAWAY INC", category: "superinvestors", score: 1 },
      { id: 2, cusip: null, code: "352012", name: "HATHAWAY & ASSOCIATES LTD", category: "superinvestors", score: 2 },
    ], "berkshire");

    expect(reranked.map((result) => result.code)).toEqual(["1067983", "352012"]);
  });

  test("injects an exact ticker match even when uFuzzy ranks it outside the top candidate window", () => {
    const geItems: CollectionSearchResult[] = [
      { id: 1, cusip: "369604103", code: "GE", name: "GEN ELEC CO", category: "assets" },
      ...Array.from({ length: 260 }, (_, index) => ({
        id: index + 2,
        cusip: null,
        code: `AGE${index}`,
        name: `AGE COMPANY ${index}`,
        category: "assets" as const,
      })),
    ];
    const geHaystack = geItems.map((item) => item.name ? `${item.code} ${item.name}` : item.code);

    const ufuzzy = {
      filter: () => Array.from({ length: 261 }, (_, index) => index),
      info: (idxs: number[]) => ({ idx: idxs }),
      sort: () => Array.from({ length: 261 }, (_, index) => index + 1).concat(0),
    };

    const metrics = runUFuzzySearch(ufuzzy, geHaystack, geItems, "ge", { query: "", idxs: null });

    expect(metrics.results[0]).toMatchObject({
      code: "GE",
      name: "GEN ELEC CO",
    });
  });
});
