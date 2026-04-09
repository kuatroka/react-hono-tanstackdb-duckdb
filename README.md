# react-hono-tanstackdb-duckdb

A high-performance analytics web application built with **React**, **Hono**, **TanStack DB**, **DuckDB**, and **Bun**.

## Stack

- **Frontend:** React 19, TanStack Router, TanStack DB, IndexedDB persistence
- **Backend:** Hono API running on Bun
- **Analytics DB:** DuckDB for read-heavy analytics queries
- **Charts:** ECharts and uPlot
- **Schema / migrations:** Drizzle ORM
- **Styling:** Tailwind CSS

## What this app does

- Provides fast search across assets and investors
- Serves analytics data from DuckDB-backed API endpoints
- Uses TanStack DB collections on the client for reactive UI state and local persistence
- Renders tables and charts with latency instrumentation for data and render timing

## Project structure

- `src/` — React UI, collections, pages, charts, shared components
- `app/` — TanStack Router route definitions
- `api/` — Hono server and API routes
- `docker/` — local database/container setup
- `scripts/` — build, benchmark, and utility scripts
- `docs/` — supporting project notes

## Getting started

Install dependencies:

```sh
bun install
```

Start the application:

```sh
bun run dev
```

This starts:

- the Bun-powered Hono API server
- the CSS build watcher
- the app entrypoint used for local development

## Build

Create a production build:

```sh
bun run build
```

Run the production server locally:

```sh
bun run start
```

## Database workflow

The app reads analytics data from DuckDB and parquet-backed APIs. There is no
separate bootstrap database workflow to run for normal development.

## Benchmarks

Available benchmark commands:

```sh
bun run benchmark:search-index
bun run benchmark:api
bun run benchmark:charts
bun run benchmark:duckdb
bun run benchmark:all
```

## Related docs

- `docs/` for project notes and migration analysis
