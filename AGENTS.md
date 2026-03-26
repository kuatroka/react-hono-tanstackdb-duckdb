
## Tech Stack and javascript runtime
- Use bun for package manager and js runtime. Never use node.js - https://bun.com/llms-rules.txt
- bun - https://bun.sh/llms.txt
- Zero sync tech - https://zero.rocicorp.dev/llms.txt

## DB and Drizzle
- Drizzle ORM - https://orm.drizzle.team/llms.txt
- Drizzle ORM Full - https://orm.drizzle.team/llms-full.txt

## Bug fixing guidelines
- When I report a bug, don't start by trying to fix it. Instead, use red/green TDD approach. Start by writing a test that reproduces the bug. Then, try to fix the bug and prove it with a passing test.

## Testing
Review, analyse, fix and self test. When testing, use agent-browser tool. Make sure to interact with the app on different routes. Especially the one where the error is produced. Use UI components like search box (make sure they work, produce result, search works), tables and charts are visible and with data. use red/green TDD approach. Only when originally failed tests pass and there are not server or browser console errors, then declare the issue fixed.


## Which command do I run?
- Normal local development: `bun run dev`. This already runs the Zero preflight automatically through `dev:zero-cache`.
- Testing the Zero preflight logic itself: `bun run test:zero-preflight`. Use this when editing `scripts/zero-preflight.mjs` or related Zero startup behavior.
- If Zero behaves strangely locally: `bun run zero:reset`, then restart with `bun run dev`.

## Local dev ports
- `3001` for Vite UI
- `4001` for API server
- `4848` for Zero cache
- `4849` for Zero change-streamer

## Zero runtime hygiene
- Zero server processes in this repo must run on a Node version supported by `@rocicorp/zero` and `@rocicorp/zero-sqlite3`. Prefer Node 24.x.
- Treat the local `ZERO_REPLICA_FILE` SQLite replica as disposable derived state, not durable app data.
- Any change to Zero package version, native sqlite package version, active Node version, or platform/arch should invalidate the local replica.
- `bun run dev:zero-cache` now runs `scripts/zero-preflight.mjs` first and may auto-delete the local replica if runtime fingerprints changed.
- Use `bun run zero:reset` when Zero behaves strangely and you want a clean local replica rebuild.

## Zero tables: what to remember when adding them
- Do not add a table to `src/schema.ts` unless the upstream Postgres table is already Zero-syncable.
- Every Zero-synced Postgres table must have a stable row identity: a primary key, or at minimum a non-null unique index. In practice, prefer a real primary key.
- Zero validates the whole declared client schema at connection time. One unsupported table in `src/schema.ts` can blank the whole app by triggering schema incompatibility.
- Keep Drizzle schema, Postgres migrations, and the external data-loading pipeline aligned. If a loader recreates or swaps tables, it must preserve or recreate the primary key / unique constraints that Zero relies on.
- For data imported from DuckDB / external systems, validate candidate key columns for nulls and duplicates before adding constraints.
- Do not rely on foreign tables, views, or materialized views for direct Zero sync. Materialize into a normal Postgres base table first, then add the key/index Zero requires.
- UI startup must stay visible even if Zero is slow or unavailable. Never hide the whole app behind a route-level readiness gate.
