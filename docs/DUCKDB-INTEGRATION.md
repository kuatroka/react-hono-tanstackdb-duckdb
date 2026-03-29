# DuckDB Integration Guide

This document describes how DuckDB-backed analytics data is integrated into `react-hono-tanstackdb-duckdb` and how to add new DuckDB-backed surfaces safely.

## Architecture Overview

```text
External data pipeline / source tables
            │
            ▼
      DuckDB database files
            │
            ▼
   Hono API routes on Bun (`api/routes/*`)
            │
            ▼
 TanStack DB collections / client fetch flows
            │
            ▼
 React tables and charts
```

## Current architectural role of DuckDB

DuckDB is the primary analytics query engine for this application.

It is used for read-heavy endpoints such as:

- assets
- superinvestors
- search index data
- all-assets activity
- investor flow
- quarterly value/history data
- drilldown/detail slices

The browser does **not** query DuckDB directly. Instead:

1. Hono API routes execute DuckDB queries
2. The frontend fetches through API routes or collection-backed query functions
3. TanStack DB collections persist and reactively expose the results on the client
4. IndexedDB-backed persistence is used for repeat navigation and instant local reads where configured

## Key principle: DuckDB is query-side, not migration-managed app storage

DuckDB tables are treated as analytics/query targets.

Implications:

- DuckDB schema is not managed from the browser
- DuckDB tables are not managed by Drizzle migrations in the same way as app-managed relational schema
- frontend code should consume typed API responses and collection data, not raw DuckDB connections

## Current DuckDB-backed surfaces

Examples already present in this repository include:

- all-assets activity data
- asset metadata
- superinvestor metadata
- search index rows
- investor-flow data
- cik-quarterly/value history data
- drilldown detail rows

Type definitions live under:

- `src/types/duckdb.ts`
- `src/types/index.ts`

API route implementations live under:

- `api/routes/`

Client collection and cache integration lives under:

- `src/collections/`

## Recommended process for adding a new DuckDB-backed feature

### 1. Define the response shape

Add or update TypeScript types in:

- `src/types/duckdb.ts`
- or another appropriate typed module under `src/types/`

Example:

```ts
export interface NewAnalyticsRow {
  label: string;
  value: number;
}

export interface NewAnalyticsResponse {
  data: NewAnalyticsRow[];
  queryTimeMs: number;
}
```

### 2. Add the API route

Create a new route under `api/routes/` that:

- opens or reuses the DuckDB connection helper used by the API layer
- runs a scoped SQL query
- maps rows into typed response objects
- returns a stable JSON response
- reports timing information if the UI needs latency data

Example shape:

```ts
import { Hono } from "hono";

const routes = new Hono();

routes.get("/", async (c) => {
  const startTime = performance.now();

  // query DuckDB here

  return c.json({
    data: [],
    queryTimeMs: Math.round((performance.now() - startTime) * 100) / 100,
  });
});

export default routes;
```

### 3. Register the route

Wire the route into `api/index.ts` so it is exposed under `/api/...`.

### 4. Decide the client access pattern

Choose the right client-side integration:

- **TanStack DB collection** for data that benefits from reactive local persistence and repeat navigation speed
- **Direct fetch / scoped request flow** for highly targeted, parameterized detail queries

Use TanStack DB + IndexedDB when the data should remain available locally for fast revisits.

### 5. Render through UI components

Connect the data to tables or charts under `src/pages/` or `src/components/charts/`.

Where applicable:

- expose query timing from the API
- expose render timing in the component
- surface both through the shared latency badge UI

## Example integration pattern

A typical current pattern is:

1. DuckDB-backed API route returns typed JSON with `queryTimeMs`
2. A collection or fetch helper under `src/collections/` or related modules loads the data
3. The page/chart component consumes the result
4. The UI shows both data and render latency

## Troubleshooting

### Conflicting lock on DuckDB file

If DuckDB reports a lock/conflict error, another process may already have the database file open.

Common causes:

- another local tool inspecting the database
- a second app/process using the same DuckDB file

### Schema changes from upstream data pipeline

If upstream DuckDB tables change:

1. update the TypeScript interfaces
2. update the affected SQL queries in API routes
3. update any collection adapters or UI assumptions that depend on the old shape

### Performance issues

If a new DuckDB-backed view is slow:

- narrow the SQL query scope
- pre-aggregate when possible
- avoid loading large detail sets eagerly into the browser
- use on-demand queries for very large fact-style datasets
- only persist locally what the UI actually benefits from revisiting
