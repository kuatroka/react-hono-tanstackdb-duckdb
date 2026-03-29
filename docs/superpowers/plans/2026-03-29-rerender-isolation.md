# Rerender Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate unnecessary rerenders across global search, list-page search, asset detail, and superinvestor detail surfaces while preserving the current UI behavior.

**Architecture:** Convert route pages into thin shells and move search, chart, flow, and drilldown state into isolated leaf sections. Keep TanStack DB subscriptions close to the surface that renders them, stop passing high-churn JSX/callback props through route roots, and add targeted regression coverage before each refactor.

**Tech Stack:** React 19, TanStack Router, TanStack DB, Bun test, Playwright, uPlot, ECharts

---

## File structure

### Create
- `src/components/global-search/GlobalSearchInput.tsx` — pure search input and keyboard control surface
- `src/components/global-search/GlobalSearchResults.tsx` — pure result list rendering for global search
- `src/components/detail/AssetActivitySection.tsx` — owns asset activity subscription, latency state, and click/hover chart coordination
- `src/components/detail/AssetFlowSection.tsx` — owns investor-flow subscription and chart timing state
- `src/components/detail/AssetDrilldownSection.tsx` — owns click/hover drilldown state, eager/background preload, and drilldown table layout
- `src/components/detail/SuperinvestorChartSection.tsx` — owns quarterly subscription and chart timing state for superinvestor detail
- `src/pages/__tests__/search-route-isolation.test.tsx` — regression tests for asset/superinvestor list search isolation and stable route-shell rendering
- `src/pages/__tests__/detail-route-isolation.test.tsx` — regression tests for asset/superinvestor detail section isolation

### Modify
- `src/components/DuckDBGlobalSearch.tsx` — reduce to a search coordinator with isolated children and no render-phase timing updates
- `app/components/global-nav.tsx` — keep nav shell stable and feed memoized global search island only
- `src/pages/AssetsTable.tsx` — split route search state from table/chart rendering, memoize columns
- `src/pages/SuperinvestorsTable.tsx` — split route search state from table rendering, memoize columns
- `src/pages/AssetDetail.tsx` — reduce to shell with minimal route record fetch and independent sections
- `src/pages/SuperinvestorDetail.tsx` — reduce to shell with minimal record fetch and chart section
- `src/components/charts/InvestorActivityUplotChart.tsx` — stabilize props and memoize export
- `src/components/charts/InvestorActivityEchartsChart.tsx` — stabilize props and memoize export
- `src/components/charts/OpenedClosedBarChart.tsx` — stop re-binding on unrelated prop churn and keep latency rendering local
- `src/components/charts/InvestorFlowChart.tsx` — memoize chart wrappers and keep render-timing local to the flow section
- `src/components/charts/CikValueLineChart.tsx` — memoize and keep timing-sensitive props narrow
- `app/asset-detail-browser-smoke.test.ts` — add route interaction coverage for search and detail surfaces

### Existing tests to run/update
- `src/components/LatencyBadge.test.tsx`
- `src/collections/page-cache-cleanup.test.ts`
- `app/asset-detail-browser-smoke.test.ts`

---

### Task 1: Isolate global search and list-route search ownership

**Files:**
- Create: `src/components/global-search/GlobalSearchInput.tsx`
- Create: `src/components/global-search/GlobalSearchResults.tsx`
- Create: `src/pages/__tests__/search-route-isolation.test.tsx`
- Modify: `src/components/DuckDBGlobalSearch.tsx`
- Modify: `app/components/global-nav.tsx`
- Modify: `src/pages/AssetsTable.tsx`
- Modify: `src/pages/SuperinvestorsTable.tsx`
- Modify: `src/components/DataTable.tsx`

- [ ] **Step 1: Write the failing search isolation tests**

```tsx
import { describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AssetsTablePage } from "../AssetsTable";
import { SuperinvestorsTablePage } from "../SuperinvestorsTable";

const routerFns = {
  navigate: mock(() => {}),
  search: { page: "1", search: "abc" },
};

mock.module("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  useNavigate: () => routerFns.navigate,
  useSearch: () => routerFns.search,
}));

mock.module("@tanstack/react-db", () => ({
  useLiveQuery: () => ({
    data: [
      { id: 1, asset: "BGRN", assetName: "Beacon", cusip: "46435U440" },
      { id: 2, cik: "1603466", cikName: "Example Capital" },
    ],
    isLoading: false,
  }),
}));

describe("route search isolation", () => {
  test("asset route keeps chart markup stable while search state changes", () => {
    const html = renderToStaticMarkup(<AssetsTablePage />);
    expect(html).toContain("All Assets Activity");
    expect(html).toContain("Assets Table");
  });

  test("superinvestor route keeps table shell stable while search state changes", () => {
    const html = renderToStaticMarkup(<SuperinvestorsTablePage />);
    expect(html).toContain("Superinvestors");
    expect(html).toContain("Search superinvestors");
  });
});
```

- [ ] **Step 2: Run the focused failing test file**

Run: `cd "/Users/yo_macbook/Documents/dev/react-hono-tanstackdb-duckdb/.worktrees/rerender-isolation" && bun test src/pages/__tests__/search-route-isolation.test.tsx`
Expected: FAIL because the new test file and isolated components do not exist yet.

- [ ] **Step 3: Write the minimal search isolation implementation**

```tsx
// src/components/global-search/GlobalSearchInput.tsx
import { memo } from "react";
import { Input } from "@/components/ui/input";

interface GlobalSearchInputProps {
  query: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}

export const GlobalSearchInput = memo(function GlobalSearchInput({ query, onChange, onFocus, onKeyDown }: GlobalSearchInputProps) {
  return (
    <Input
      type="search"
      placeholder="DuckDB Search..."
      value={query}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      className="w-full sm:w-[30rem] pr-16"
    />
  );
});
```

```tsx
// src/components/global-search/GlobalSearchResults.tsx
import { memo } from "react";
import type { SearchResult } from "@/components/DuckDBGlobalSearch";

interface GlobalSearchResultsProps {
  results: SearchResult[];
  highlightedIndex: number;
  onHover: (index: number) => void;
  onSelect: (result: SearchResult) => void;
}

export const GlobalSearchResults = memo(function GlobalSearchResults({ results, highlightedIndex, onHover, onSelect }: GlobalSearchResultsProps) {
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
            <span className="truncate">{result.name || result.code}</span>
            <span className="text-xs text-muted-foreground">{result.category === "assets" ? result.cusip || "" : result.code}</span>
          </div>
          <span className="ml-auto text-xs uppercase text-muted-foreground">{result.category}</span>
        </button>
      ))}
    </>
  );
});
```

```tsx
// in src/components/DuckDBGlobalSearch.tsx
export interface SearchResult extends CollectionSearchResult {
  score: number;
}

const localSearchMetrics = useMemo(() => {
  if (!shouldSearch) return { results: [], latencyMs: undefined as number | undefined };
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
```

```tsx
// in src/pages/AssetsTable.tsx and src/pages/SuperinvestorsTable.tsx
const columns = useMemo<ColumnDef<Asset>[]>(() => [
  {
    key: "asset",
    header: "Asset",
    sortable: true,
    searchable: true,
    clickable: true,
    render: (value, row, isFocused) => (
      <Link
        to="/assets/$code/$cusip"
        params={{ code: row.asset, cusip: row.cusip ?? "_" }}
        onMouseDown={() => {
          rowSelectedRef.current = true;
        }}
        className={`hover:underline underline-offset-4 cursor-pointer text-foreground outline-none ${isFocused ? "underline" : ""}`}
      >
        {String(value)}
      </Link>
    ),
  },
  { key: "assetName", header: "Asset Name", sortable: true, searchable: true },
], []);
```

- [ ] **Step 4: Run the focused tests again**

Run: `cd "/Users/yo_macbook/Documents/dev/react-hono-tanstackdb-duckdb/.worktrees/rerender-isolation" && bun test src/pages/__tests__/search-route-isolation.test.tsx src/components/LatencyBadge.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit the search isolation task**

```bash
git -C "/Users/yo_macbook/Documents/dev/react-hono-tanstackdb-duckdb/.worktrees/rerender-isolation" add src/components/global-search/GlobalSearchInput.tsx src/components/global-search/GlobalSearchResults.tsx src/components/DuckDBGlobalSearch.tsx src/pages/AssetsTable.tsx src/pages/SuperinvestorsTable.tsx src/components/DataTable.tsx src/pages/__tests__/search-route-isolation.test.tsx
git -C "/Users/yo_macbook/Documents/dev/react-hono-tanstackdb-duckdb/.worktrees/rerender-isolation" commit -m "refactor search surface ownership"
```

### Task 2: Partition the asset detail route into isolated sections

**Files:**
- Create: `src/components/detail/AssetActivitySection.tsx`
- Create: `src/components/detail/AssetFlowSection.tsx`
- Create: `src/components/detail/AssetDrilldownSection.tsx`
- Create: `src/pages/__tests__/detail-route-isolation.test.tsx`
- Modify: `src/pages/AssetDetail.tsx`
- Modify: `src/components/charts/InvestorActivityUplotChart.tsx`
- Modify: `src/components/charts/InvestorActivityEchartsChart.tsx`
- Modify: `src/components/charts/OpenedClosedBarChart.tsx`
- Modify: `src/components/charts/InvestorFlowChart.tsx`
- Modify: `src/components/InvestorActivityDrilldownTable.tsx`

- [ ] **Step 1: Write the failing asset detail isolation tests**

```tsx
import { describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AssetDetailPage } from "../AssetDetail";

mock.module("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  useParams: () => ({ code: "BGRN", cusip: "46435U440" }),
}));

mock.module("@/collections", () => ({
  fetchAssetRecord: async () => ({ asset: "BGRN", assetName: "Beacon", cusip: "46435U440" }),
  fetchAssetActivityData: async () => ({ queryTimeMs: 5, source: "api" }),
  fetchInvestorFlowData: async () => ({ queryTimeMs: 5, source: "api" }),
  assetActivityCollection: {},
  investorFlowCollection: {},
}));

describe("asset detail isolation", () => {
  test("renders shell without owning chart and drilldown state directly", () => {
    const html = renderToStaticMarkup(<AssetDetailPage />);
    expect(html).toContain("Back to assets");
  });
});
```

- [ ] **Step 2: Run the focused failing detail isolation tests**

Run: `cd "/Users/yo_macbook/Documents/dev/react-hono-tanstackdb-duckdb/.worktrees/rerender-isolation" && bun test src/pages/__tests__/detail-route-isolation.test.tsx`
Expected: FAIL because the new section files do not exist yet.

- [ ] **Step 3: Write the minimal sectioned asset detail implementation**

```tsx
// src/components/detail/AssetActivitySection.tsx
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "@tanstack/react-db";
import { assetActivityCollection, fetchAssetActivityData } from "@/collections";
import { InvestorActivityUplotChart } from "@/components/charts/InvestorActivityUplotChart";
import { InvestorActivityEchartsChart } from "@/components/charts/InvestorActivityEchartsChart";

export const AssetActivitySection = memo(function AssetActivitySection({ code, cusip, onSelectionChange, onHoverChange }: {
  code: string;
  cusip: string | null;
  onSelectionChange: (selection: { quarter: string; action: "open" | "close" }) => void;
  onHoverChange: (selection: { quarter: string; action: "open" | "close" } | null) => void;
}) {
  const [queryTimeMs, setQueryTimeMs] = useState<number | null>(null);
  const [dataSource, setDataSource] = useState<"unknown" | "tsdb-api" | "tsdb-indexeddb" | "tsdb-memory">("unknown");
  const [uplotRenderMs, setUplotRenderMs] = useState<number | null>(null);
  const [echartsRenderMs, setEchartsRenderMs] = useState<number | null>(null);
  const { data } = useLiveQuery((q) => q.from({ rows: assetActivityCollection }));

  useEffect(() => {
    let cancelled = false;
    fetchAssetActivityData(code, cusip).then(({ queryTimeMs, source }) => {
      if (cancelled) return;
      setQueryTimeMs(queryTimeMs);
      setDataSource(source === "api" ? "tsdb-api" : source === "indexeddb" ? "tsdb-indexeddb" : "tsdb-memory");
    });
    return () => {
      cancelled = true;
    };
  }, [code, cusip]);

  const rows = useMemo(() => (data ?? []).filter((row) => cusip ? row.ticker === code && row.cusip === cusip : row.ticker === code), [code, cusip, data]);
  const handleBarLeave = useCallback(() => onHoverChange(null), [onHoverChange]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <InvestorActivityUplotChart data={rows} ticker={code} dataLoadMs={queryTimeMs ?? undefined} renderMs={uplotRenderMs ?? undefined} source={dataSource} onBarClick={onSelectionChange} onBarHover={onHoverChange} onBarLeave={handleBarLeave} onRenderComplete={setUplotRenderMs} />
      <InvestorActivityEchartsChart data={rows} ticker={code} dataLoadMs={queryTimeMs ?? undefined} renderMs={echartsRenderMs ?? undefined} source={dataSource} onBarClick={onSelectionChange} onBarHover={onHoverChange} onBarLeave={handleBarLeave} onRenderComplete={setEchartsRenderMs} />
    </div>
  );
});
```

```tsx
// src/pages/AssetDetail.tsx
export function AssetDetailPage() {
  const { code, cusip } = useParams({ strict: false }) as { code?: string; cusip?: string };
  const hasCusip = Boolean(cusip && cusip !== "_");
  const normalizedCusip = hasCusip ? cusip! : null;
  const [record, setRecord] = useState<Asset | null | undefined>(undefined);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    fetchAssetRecord(code, normalizedCusip).then((assetRecord) => {
      if (!cancelled) setRecord(assetRecord);
    });
    return () => {
      cancelled = true;
    };
  }, [code, normalizedCusip]);

  if (!code) return <div className="p-6">Missing asset code.</div>;
  if (record === undefined) return <div className="p-6">Loading…</div>;
  if (!record) return <div className="p-6">Asset not found.</div>;

  return (
    <>
      <AssetDetailHeader record={record} />
      <div className="mt-8 px-4 sm:px-6 lg:px-8 space-y-6">
        <AssetActivitySection code={record.asset} cusip={record.cusip} onSelectionChange={...} onHoverChange={...} />
        <AssetFlowSection code={record.asset} />
        <AssetDrilldownSection code={record.asset} cusip={record.cusip} />
      </div>
    </>
  );
}
```

- [ ] **Step 4: Run the asset detail regression tests**

Run: `cd "/Users/yo_macbook/Documents/dev/react-hono-tanstackdb-duckdb/.worktrees/rerender-isolation" && bun test src/pages/__tests__/detail-route-isolation.test.tsx src/collections/page-cache-cleanup.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit the asset detail partition task**

```bash
git -C "/Users/yo_macbook/Documents/dev/react-hono-tanstackdb-duckdb/.worktrees/rerender-isolation" add src/components/detail/AssetActivitySection.tsx src/components/detail/AssetFlowSection.tsx src/components/detail/AssetDrilldownSection.tsx src/pages/AssetDetail.tsx src/components/charts/InvestorActivityUplotChart.tsx src/components/charts/InvestorActivityEchartsChart.tsx src/components/charts/OpenedClosedBarChart.tsx src/components/charts/InvestorFlowChart.tsx src/components/InvestorActivityDrilldownTable.tsx src/pages/__tests__/detail-route-isolation.test.tsx
git -C "/Users/yo_macbook/Documents/dev/react-hono-tanstackdb-duckdb/.worktrees/rerender-isolation" commit -m "refactor asset detail rerender boundaries"
```

### Task 3: Partition the superinvestor detail route and stabilize chart props

**Files:**
- Create: `src/components/detail/SuperinvestorChartSection.tsx`
- Modify: `src/pages/SuperinvestorDetail.tsx`
- Modify: `src/components/charts/CikValueLineChart.tsx`
- Modify: `src/components/charts/InvestorFlowChart.tsx`
- Modify: `src/components/charts/InvestorActivityEchartsChart.tsx`
- Modify: `src/components/charts/InvestorActivityUplotChart.tsx`

- [ ] **Step 1: Write the failing superinvestor detail isolation assertions**

```tsx
import { describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SuperinvestorDetailPage } from "../SuperinvestorDetail";

mock.module("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  useParams: () => ({ cik: "1603466" }),
}));

mock.module("@/collections", () => ({
  fetchSuperinvestorRecord: async () => ({ cik: "1603466", cikName: "Example Capital" }),
  fetchCikQuarterlyData: async () => ({ queryTimeMs: 4, source: "api" }),
  cikQuarterlyCollection: {},
}));

describe("superinvestor detail isolation", () => {
  test("renders the route shell with an isolated chart section", () => {
    const html = renderToStaticMarkup(<SuperinvestorDetailPage />);
    expect(html).toContain("Back to superinvestors");
  });
});
```

- [ ] **Step 2: Run the focused failing test**

Run: `cd "/Users/yo_macbook/Documents/dev/react-hono-tanstackdb-duckdb/.worktrees/rerender-isolation" && bun test src/pages/__tests__/detail-route-isolation.test.tsx`
Expected: FAIL until the chart section is extracted.

- [ ] **Step 3: Write the minimal superinvestor section implementation**

```tsx
// src/components/detail/SuperinvestorChartSection.tsx
import { memo, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "@tanstack/react-db";
import { CikValueLineChart } from "@/components/charts/CikValueLineChart";
import { cikQuarterlyCollection, fetchCikQuarterlyData } from "@/collections";

export const SuperinvestorChartSection = memo(function SuperinvestorChartSection({ cik, cikName }: { cik: string; cikName: string }) {
  const [queryTimeMs, setQueryTimeMs] = useState<number | null>(null);
  const [renderMs, setRenderMs] = useState<number | null>(null);
  const [source, setSource] = useState<"unknown" | "tsdb-api" | "tsdb-indexeddb" | "tsdb-memory">("unknown");
  const { data } = useLiveQuery((q) => q.from({ rows: cikQuarterlyCollection }));

  useEffect(() => {
    let cancelled = false;
    fetchCikQuarterlyData(cik).then(({ queryTimeMs, source }) => {
      if (cancelled) return;
      setQueryTimeMs(queryTimeMs);
      setSource(source === "api" ? "tsdb-api" : source === "indexeddb" ? "tsdb-indexeddb" : "tsdb-memory");
    });
    return () => {
      cancelled = true;
    };
  }, [cik]);

  const rows = useMemo(() => (data ?? []).filter((row) => row.cik === cik).sort((left, right) => left.quarter.localeCompare(right.quarter)), [cik, data]);

  return <CikValueLineChart data={rows} cikName={cikName} dataLoadMs={queryTimeMs ?? undefined} renderMs={renderMs ?? undefined} source={source} onRenderComplete={setRenderMs} />;
});
```

```tsx
// src/pages/SuperinvestorDetail.tsx
return (
  <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
    <SuperinvestorHeaderCard record={record} queryTimeMs={queryTimeMs} source={recordSource} />
    <SuperinvestorChartSection cik={record.cik} cikName={record.cikName} />
  </div>
);
```

- [ ] **Step 4: Run the focused tests again**

Run: `cd "/Users/yo_macbook/Documents/dev/react-hono-tanstackdb-duckdb/.worktrees/rerender-isolation" && bun test src/pages/__tests__/detail-route-isolation.test.tsx src/components/LatencyBadge.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit the superinvestor detail partition task**

```bash
git -C "/Users/yo_macbook/Documents/dev/react-hono-tanstackdb-duckdb/.worktrees/rerender-isolation" add src/components/detail/SuperinvestorChartSection.tsx src/pages/SuperinvestorDetail.tsx src/components/charts/CikValueLineChart.tsx src/components/charts/InvestorFlowChart.tsx src/components/charts/InvestorActivityEchartsChart.tsx src/components/charts/InvestorActivityUplotChart.tsx
git -C "/Users/yo_macbook/Documents/dev/react-hono-tanstackdb-duckdb/.worktrees/rerender-isolation" commit -m "refactor superinvestor detail rerender boundaries"
```

### Task 4: Browser verification and final regression pass

**Files:**
- Modify: `app/asset-detail-browser-smoke.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Add browser verification for search and isolated detail interactions**

```ts
test("typing in global search keeps detail route stable and searchable", async () => {
  const page = await browser.newPage();
  const { pageErrors, consoleErrors, requests } = trackPageIssues(page);

  await page.goto(`${baseUrl}/assets/BGRN/46435U440`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("DuckDB Search...").fill("BGRN");
  await page.waitForTimeout(500);

  expect(await page.locator("text=Investor Activity for BGRN (ECharts)").count()).toBeGreaterThan(0);
  expect(requests.some((url) => url.endsWith("/api/assets"))).toBe(false);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);

  await page.close();
});

test("chart hover and click keep sibling sections alive", async () => {
  const page = await browser.newPage();
  const { pageErrors, consoleErrors } = trackPageIssues(page);

  await page.goto(`${baseUrl}/assets/BGRN/46435U440`, { waitUntil: "networkidle" });
  await page.locator("text=Investor Activity for BGRN (ECharts)").scrollIntoViewIfNeeded();
  await page.mouse.move(500, 500);
  await page.mouse.click(500, 500);
  await page.waitForTimeout(500);

  expect(await page.locator("text=Investor Flow for BGRN (ECharts)").count()).toBeGreaterThan(0);
  expect(await page.locator("text=Click Interaction").count()).toBeGreaterThan(0);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);

  await page.close();
});
```

- [ ] **Step 2: Install browser dependency for the baseline failing Playwright test**

Run: `cd "/Users/yo_macbook/Documents/dev/react-hono-tanstackdb-duckdb/.worktrees/rerender-isolation" && bunx playwright install chromium`
Expected: Chromium download completes successfully.

- [ ] **Step 3: Run the full automated verification**

Run: `cd "/Users/yo_macbook/Documents/dev/react-hono-tanstackdb-duckdb/.worktrees/rerender-isolation" && bun test`
Expected: PASS for the Bun suite, including the browser smoke test.

- [ ] **Step 4: Run local app for manual browser verification with react-scan**

Run: `cd "/Users/yo_macbook/Documents/dev/react-hono-tanstackdb-duckdb/.worktrees/rerender-isolation" && bun run dev`
Expected: Local app serves successfully with `react-scan` available from `index.html`.

- [ ] **Step 5: Verify routes and interactions in browser tools**

Use browser tooling to validate:
- global search on `/`
- list-page search on `/assets` and `/superinvestors`
- asset detail charts and drilldown on `/assets/BGRN/46435U440`
- superinvestor detail chart on `/superinvestors/1603466`
- no console errors, no page errors, no server errors
- react-scan shows only the directly affected search/chart/table surfaces rerendering during interactions

- [ ] **Step 6: Commit the verification updates**

```bash
git -C "/Users/yo_macbook/Documents/dev/react-hono-tanstackdb-duckdb/.worktrees/rerender-isolation" add app/asset-detail-browser-smoke.test.ts package.json
git -C "/Users/yo_macbook/Documents/dev/react-hono-tanstackdb-duckdb/.worktrees/rerender-isolation" commit -m "test rerender isolation verification"
```

## Self-review
- Spec coverage check: Task 1 covers global and list-page search isolation; Task 2 covers asset detail partitioning; Task 3 covers superinvestor detail partitioning; Task 4 covers Bun and browser verification with react-scan.
- Placeholder scan: no TODO/TBD placeholders remain.
- Type consistency: search/chart section names and props are consistent across tasks.
