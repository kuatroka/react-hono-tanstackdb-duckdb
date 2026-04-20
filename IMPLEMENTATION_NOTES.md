# Implementation Notes

## Curation Rules
- Re-prioritize on every read.
- Keep recurring, high-value notes only.
- Max 10 items per category.
- Each item includes date + "Do instead".

## Search Architecture & Performance
1. **[2026-04-20] Keep global search on the shared uFuzzy engine**
   Do instead: implement navbar/entity search behavior in `src/components/UFuzzyGlobalSearch.tsx` and reuse helpers from `src/lib/ufuzzy-search.ts` rather than adding a second client-side search engine.
2. **[2026-04-20] Use table-local uFuzzy only through `VirtualDataTable`**
   Do instead: enable fuzzy matching for large local tables by passing `searchStrategy="ufuzzy"` to `src/components/VirtualDataTable.tsx` instead of duplicating search logic inside each page component.
3. **[2026-04-20] Assets and superinvestors tables are the current uFuzzy table surfaces**
   Do instead: keep `src/pages/AssetsTable.tsx` and `src/pages/SuperinvestorsTable.tsx` on `VirtualDataTable` with `searchStrategy="ufuzzy"` so typo-tolerant local filtering stays shared and consistent.
4. **[2026-04-20] Drilldown search should remain simple local filtering unless requirements change**
   Do instead: leave `src/components/InvestorActivityDrilldownTable.tsx` on the default includes-based `VirtualDataTable` search path unless there is an explicit reason to add fuzzy matching there.
