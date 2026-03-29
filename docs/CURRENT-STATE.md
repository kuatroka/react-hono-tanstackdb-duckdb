# Current State - react-hono-tanstackdb-duckdb

**Last Updated:** 2026-03-27  
**Status:** Active

---

## What This App Does

`react-hono-tanstackdb-duckdb` is a read-heavy analytics application for exploring assets, superinvestors, and quarter-based activity data.

It combines:

- **React** for the UI
- **Hono** for the API layer
- **TanStack DB** for reactive client-side collections
- **IndexedDB** for persisted client-side cache/storage
- **DuckDB** for analytics queries
- **Bun** for runtime, package management, and builds

---

## Current Features

### Search
- Global search over assets and superinvestors
- Client-side reactive querying through TanStack DB collections
- IndexedDB-backed persistence for fast repeat loads

### Tables and Detail Views
- Assets table
- Superinvestors table
- Asset detail pages
- Superinvestor detail pages
- Drilldown/detail table flows backed by API + persisted client-side collections

### Charts
- ECharts and uPlot visualizations are both used in the app
- Activity, investor-flow, and value-history style chart views are rendered from DuckDB-backed data
- Latency badges expose data and render timing in active surfaces

---

## Architecture

### Frontend
- React 19
- TanStack Router
- TanStack DB collections queried with live/reactive APIs
- IndexedDB persistence for local cached datasets
- Tailwind CSS-based styling

### Backend
- Hono API served by Bun
- API routes under `api/`
- Production server entry at `api/server.ts`

### Data Layer
- **DuckDB** is the main analytics database
- DuckDB-backed API routes provide asset, superinvestor, quarterly, search, and drilldown data
- **TanStack DB** collections manage local client-side query state and persistence
- IndexedDB is used for persisted client-side cache rather than memory-only storage for the main reactive surfaces

### Migrations / Schema
- Drizzle ORM is used for schema and migration workflow where applicable in this repository
- DuckDB analytics tables are treated as query targets, not managed browser-side storage

---

## Important Current Conventions

### Runtime and Tooling
- Bun is the runtime and package manager
- Build and dev commands are run through `bun run ...`
- The production build is generated from `index.html` and served by the Bun/Hono server

### Routing
- Route definitions live under `app/`
- UI implementation lives under `src/`
- API routes live under `api/routes/`

### Local Persistence
- TanStack DB collections are the primary reactive client data surface
- IndexedDB-backed persistence is the intended cache layer for responsive repeat navigation and search

---

## Key Directories

- `src/` — UI pages, charts, collections, hooks, components
- `app/` — router definitions
- `api/` — Hono API server and route handlers
- `docs/` — project notes and historical analysis
- `docker/` — local database/container setup
- `scripts/` — build and benchmark tooling

---

## Development Snapshot

Typical local workflow:

```bash
bun install
bun run dev:db-up
bun run dev
```

Useful commands:

```bash
bun run build
bun run start
bun run db:generate
bun run db:migrate
bun run benchmark:all
```

---

## Historical Note

Older project documentation in this repository may still reference:

- Zero-sync / Zero cache
- PostgreSQL-first sync architecture
- the previous repository name

Those references should be treated as historical context unless a document explicitly says it is current.
