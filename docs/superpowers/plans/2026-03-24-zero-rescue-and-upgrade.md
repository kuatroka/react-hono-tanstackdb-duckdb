# Zero Rescue and Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore live Zero-backed data and charts in `zero-hono-before-tanstack-migration` on the current Zero version, then upgrade the repo to the latest stable Zero `1.0.x`, and update essential docs to match the working setup.

**Architecture:** Treat the app as a four-boundary pipeline: browser UI → synced query endpoint → zero-cache → PostgreSQL. First, reproduce and prove the failing boundary with runtime evidence. Then apply the minimum fix needed to restore the current `0.24.x` app, verify a working baseline, perform the Zero `1.0.x` migration, and re-run the same smoke path. Keep docs aligned with the final, working runtime.

**Tech Stack:** Bun, React, Vite, Hono, PostgreSQL, Zero (`@rocicorp/zero`), TypeScript, Drizzle migrations, concurrently.

---

## File Structure / Responsibilities

### Runtime and config
- Modify: `.env` — local runtime wiring for Zero, API, UI, and replica settings
- Modify: `package.json` — scripts and Zero dependency version
- Modify: `vite.config.ts` — UI dev port and `/api` proxy wiring
- Modify: `api/server.ts` — API port binding behavior

### Zero client and query path
- Modify: `src/main.tsx` — ZeroProvider setup, `server`, `getQueriesURL`, storage/auth wiring
- Modify: `src/zero-client.ts` — app-level Zero instance accessors used by preload and legacy helpers
- Modify: `src/zero/queries.ts` — synced query definitions if `1.0.x` requires compatibility changes
- Modify: `src/zero-preload.ts` — preload behavior if needed after rescue/upgrade
- Modify: `src/schema.ts` — Zero schema and permissions if migration requires updates
- Modify: `api/routes/zero/get-queries.ts` — synced query endpoint, validation, response path
- Modify: `api/index.ts` — route mounting and auth route compatibility

### UI smoke-path files
- Modify: `src/pages/AssetsTable.tsx` — list/search page smoke target
- Modify: `src/pages/AssetDetail.tsx` — detail page + chart smoke target
- Modify: `src/pages/SuperinvestorDetail.tsx` — secondary detail smoke path if needed
- Modify: `src/components/CounterPage.tsx` — counter/charts smoke path if asset charts are blocked
- Modify: `src/components/GlobalSearch.tsx` — search smoke target if zero query flow is broken

### Data/bootstrap
- Modify: `scripts/db-seed.ts` — only if rescue shows missing seed assumptions
- Modify: `docker/docker-compose.yml` — only if runtime evidence shows DB startup mismatch
- Modify: `docker/migrations/...` — only if schema/data mismatch is proven

### Docs
- Modify: `README.md` — final working startup commands, ports, Zero URLs
- Modify: `docs/superpowers/specs/2026-03-24-zero-hono-before-tanstack-migration-zero-rescue-and-upgrade-design.md` — only if design intent must be clarified after implementation
- Create or modify: `docs/...` minimal targeted note only if README is insufficient for final migration notes

### Verification artifacts
- Create: `docs/superpowers/plans/2026-03-24-zero-rescue-and-upgrade.md` — this plan
- Create: a small ad-hoc verification note only if needed to record exact smoke path used

---

## Task 1: Capture a reliable failing baseline

**Files:**
- Read: `.env`
- Read: `package.json`
- Read: `vite.config.ts`
- Read: `api/server.ts`
- Read: `api/index.ts`
- Read: `src/main.tsx`
- Read: `api/routes/zero/get-queries.ts`
- Optional Create: `docs/zero-rescue-debug-notes.md`

- [ ] **Step 1: Confirm no code changes are made before evidence gathering**

Run:
```bash
cd /Users/yo_macbook/Documents/dev/zero-hono-before-tanstack-migration
git status --short
```
Expected: See current repo state; do not edit files yet.

- [ ] **Step 2: Verify the effective runtime ports from source files**

Run:
```bash
cd /Users/yo_macbook/Documents/dev/zero-hono-before-tanstack-migration
printf '\n.env\n' && rg -n 'API_PORT|VITE_PUBLIC_SERVER|ZERO_GET_QUERIES|VITE_ZERO_GET_QUERIES' .env
printf '\nvite.config.ts\n' && rg -n 'port|proxy' vite.config.ts
printf '\napi/server.ts\n' && rg -n 'API_PORT|Bun.serve' api/server.ts
```
Expected: Clear mapping of expected API/UI/Zero endpoints from code and env.

- [ ] **Step 3: Reproduce the blank-data symptom with all services running**

Run in separate terminals if not already running:
```bash
cd /Users/yo_macbook/Documents/dev/zero-hono-before-tanstack-migration
bun run dev:db-up
bun run dev
```
Then open `http://localhost:3001` and navigate to a page expected to show live data.
Expected: UI shell loads but data/charts are absent.

- [ ] **Step 4: Capture process bindings to prove what is actually listening**

Run:
```bash
lsof -nP -iTCP:3001 -iTCP:3003 -iTCP:4000 -iTCP:4001 -iTCP:4848 -sTCP:LISTEN
```
Expected: Identify the real listeners for UI, API, and zero-cache.

- [ ] **Step 5: Probe the API login and synced-query routes directly**

Run:
```bash
curl -i http://localhost:4001/api/login || true
curl -i http://localhost:4000/api/login || true
curl -i -X POST http://localhost:4001/api/zero/get-queries -H 'content-type: application/json' --data '{}' || true
curl -i -X POST http://localhost:4000/api/zero/get-queries -H 'content-type: application/json' --data '{}' || true
```
Expected: At least one API port responds; failed port mismatch should be obvious if present.

- [ ] **Step 6: Capture browser evidence at the failing boundary**

Use DevTools on `http://localhost:3001`:
- Network tab filtered to `get-queries`
- Console errors
- failed request URLs and status codes

Expected: exact failing URL, status code, and any browser-side Zero errors.

- [ ] **Step 7: Capture zero-cache and API logs during reproduction**

If `bun run dev` output is noisy, run separately:
```bash
cd /Users/yo_macbook/Documents/dev/zero-hono-before-tanstack-migration
bun run dev:api
bun run dev:zero-cache
```
Expected: Either clean successful requests or a clear error on startup / query handling / upstream DB access.

- [ ] **Step 8: Compare against one known-good reference before proposing the fix**

Reference files to inspect:
- `src/main.tsx`
- `api/routes/zero/get-queries.ts`
- `api/index.ts`
- Zero docs or Rocicorp reference app for equivalent synced-query setup

Expected: a concise note stating the first broken boundary and how the repo differs from a working pattern.

- [ ] **Step 9: Write a one-paragraph root-cause statement**

Create a short note in working notes or commit message draft answering:
- What is broken?
- Where is it broken?
- What exact evidence proves it?
- What is the smallest fix to test first?

- [ ] **Step 10: Commit the investigation note only if you created one and it is useful**

```bash
git add docs/zero-rescue-debug-notes.md
git commit -m "docs: record Zero rescue baseline evidence"
```
Only do this if the note is genuinely helpful.

---

## Task 2: Add a minimal failing verification for the diagnosed boundary

**Files:**
- Create: `scripts/verify-zero-path.ts` or `scripts/check-zero-config.ts` (choose one focused file)
- Modify: `package.json` (only if adding a one-off verification script is useful)

- [ ] **Step 1: Write a tiny reproduction script for the specific broken boundary**

Examples:
- if port mismatch: script validates env URLs and expected listeners
- if query route mismatch: script posts a minimal request and asserts non-404
- if config drift: script prints effective client/server Zero URLs from env and code assumptions

Suggested file:
`/Users/yo_macbook/Documents/dev/zero-hono-before-tanstack-migration/scripts/check-zero-config.ts`

- [ ] **Step 2: Make the script fail against the current broken state**

Run:
```bash
cd /Users/yo_macbook/Documents/dev/zero-hono-before-tanstack-migration
bun run scripts/check-zero-config.ts
```
Expected: FAIL with a specific mismatch message.

- [ ] **Step 3: Keep the script narrow**

Do not build a framework. One script proving the diagnosed failure is enough.

- [ ] **Step 4: If useful, add a package script**

Example:
```json
"verify:zero-path": "bun run scripts/check-zero-config.ts"
```
Only add this if it will remain useful after the fix.

- [ ] **Step 5: Commit the failing verification harness**

```bash
git add scripts/check-zero-config.ts package.json
git commit -m "test: add Zero path verification script"
```

---

## Task 3: Restore the app on the current Zero version

**Files:**
- Modify: `.env`
- Modify: `vite.config.ts`
- Modify: `api/server.ts`
- Modify: `src/main.tsx`
- Modify: `api/routes/zero/get-queries.ts`
- Modify: `api/index.ts`
- Modify: `src/zero-client.ts`
- Modify: any directly implicated smoke-path file(s) only if root cause points there

- [ ] **Step 1: Make the smallest root-cause fix only**

Examples of acceptable minimal fixes:
- align `VITE_ZERO_GET_QUERIES_URL` with the actual API port
- align Vite proxy with the actual API port
- ensure the query route is mounted where the client calls it
- correct a broken ZeroProvider option name/value
- fix a startup issue preventing zero-cache from connecting

Do **not** combine multiple speculative fixes.

- [ ] **Step 2: Re-run the narrow failing verification**

Run:
```bash
cd /Users/yo_macbook/Documents/dev/zero-hono-before-tanstack-migration
bun run scripts/check-zero-config.ts
```
Expected: PASS or at least move from previous failure to the next precise issue.

- [ ] **Step 3: Restart the affected dev process(es)**

Run the minimum needed restart, e.g.:
```bash
pkill -f 'api/server.ts' || true
pkill -f 'zero-cache' || true
cd /Users/yo_macbook/Documents/dev/zero-hono-before-tanstack-migration
bun run dev:api
bun run dev:zero-cache
```
Expected: clean startup without the previously observed error.

- [ ] **Step 4: Verify the primary smoke path in the browser**

Smoke target order:
1. assets list page
2. asset detail page
3. chart section

Expected:
- rows appear on list page
- detail record resolves
- at least one chart displays non-empty data

- [ ] **Step 5: Verify synced-query traffic is succeeding**

Use browser Network tab and/or curl.
Expected:
- `/api/zero/get-queries` returns success
- no repeated 404/500 loop for core data path

- [ ] **Step 6: Verify zero-cache is healthy against Postgres**

Check logs for successful startup and absence of the root-cause error.
Expected: zero-cache connected, serving requests, no fatal upstream mismatch.

- [ ] **Step 7: If smoke path still fails, stop and return to evidence gathering**

Do not layer additional fixes without a fresh hypothesis.

- [ ] **Step 8: Commit the rescue fix**

```bash
git add .env vite.config.ts api/server.ts src/main.tsx api/routes/zero/get-queries.ts api/index.ts src/zero-client.ts scripts/check-zero-config.ts package.json
git commit -m "fix: restore Zero data path on current version"
```
Stage only the files actually changed.

---

## Task 4: Verify a stable pre-upgrade baseline

**Files:**
- Optional Create: `docs/zero-smoke-checklist.md`

- [ ] **Step 1: Run the rescued app from a clean-ish restart**

Run:
```bash
cd /Users/yo_macbook/Documents/dev/zero-hono-before-tanstack-migration
pkill -f 'vite' || true
pkill -f 'api/server.ts' || true
pkill -f 'zero-cache' || true
bun run dev
```
Expected: all three services start and remain healthy.

- [ ] **Step 2: Verify the three-path smoke test**

Browser checks:
- `/assets` shows rows
- open one asset detail route and verify record text
- verify at least one chart is visibly populated

- [ ] **Step 3: Optionally verify login path if mutations are involved**

Run in browser or curl:
```bash
curl -i http://localhost:4001/api/login || curl -i http://localhost:4000/api/login
```
Expected: auth cookie path works on the active API port.

- [ ] **Step 4: Record the confirmed working baseline**

Write down:
- real UI port
- real API port
- Zero cache URL
- which page/chart was used as smoke proof

- [ ] **Step 5: Commit the baseline note only if created**

```bash
git add docs/zero-smoke-checklist.md
git commit -m "docs: record Zero rescue smoke baseline"
```

---

## Task 5: Research and stage the Zero `1.0.x` upgrade

**Files:**
- Read: `package.json`
- Read: `bun.lock`
- Read: `src/main.tsx`
- Read: `src/schema.ts`
- Read: `src/zero/queries.ts`
- Read: `api/routes/zero/get-queries.ts`
- Modify later: same files if migration requires it

- [ ] **Step 1: Confirm the latest stable target version**

Run:
```bash
npm view @rocicorp/zero version
```
Expected: exact latest stable version, likely `1.0.0` or `1.0.1`.

- [ ] **Step 2: Inspect release notes / migration guidance for affected APIs**

Focus on:
- `ZeroProvider` props / creation pattern
- `useQuery`, `useZero`
- `syncedQuery`, `withValidation`, `handleGetQueriesRequest`
- schema / permissions helpers
- zero-cache CLI or env behavior

- [ ] **Step 3: Compare those notes against actual repo usage**

Create a short compatibility checklist with yes/no answers for:
- client init
- query API
- server API
- schema API
- CLI / scripts

- [ ] **Step 4: Decide whether the upgrade is a pure version bump or needs code changes**

Expected: a precise list of files to touch during migration.

- [ ] **Step 5: Commit nothing yet if this step is research only**

Research notes can stay uncommitted unless they meaningfully help future work.

---

## Task 6: Upgrade dependencies and apply the smallest compatibility changes

**Files:**
- Modify: `package.json`
- Modify: `bun.lock`
- Modify: `src/main.tsx`
- Modify: `src/schema.ts`
- Modify: `src/zero/queries.ts`
- Modify: `api/routes/zero/get-queries.ts`
- Modify: `src/zero-preload.ts`
- Modify: `src/zero-client.ts`
- Modify: `package.json` scripts if CLI behavior changed

- [ ] **Step 1: Bump Zero dependency deliberately**

Run:
```bash
cd /Users/yo_macbook/Documents/dev/zero-hono-before-tanstack-migration
bun add @rocicorp/zero@<TARGET_VERSION>
```
Expected: `package.json` and `bun.lock` updated.

- [ ] **Step 2: Rebuild any native dependency if prompted**

If Zero SQLite native module errors appear:
```bash
npm rebuild @rocicorp/zero-sqlite3
```
Only if needed.

- [ ] **Step 3: Run the narrow verification / build to expose incompatibilities fast**

Run:
```bash
cd /Users/yo_macbook/Documents/dev/zero-hono-before-tanstack-migration
bun run build
```
Expected: either build success or precise compile/runtime incompatibility errors.

- [ ] **Step 4: Apply the minimum compatibility edits indicated by the errors and migration notes**

Common targets:
- `src/main.tsx`
- `src/schema.ts`
- `src/zero/queries.ts`
- `api/routes/zero/get-queries.ts`

Keep changes scoped to compatibility, not cleanup.

- [ ] **Step 5: Re-run build until it passes**

Run:
```bash
bun run build
```
Expected: PASS.

- [ ] **Step 6: Restart dev services on the upgraded version**

Run:
```bash
pkill -f 'vite' || true
pkill -f 'api/server.ts' || true
pkill -f 'zero-cache' || true
cd /Users/yo_macbook/Documents/dev/zero-hono-before-tanstack-migration
bun run dev
```
Expected: upgraded app starts cleanly.

- [ ] **Step 7: Commit the version upgrade and compatibility changes**

```bash
git add package.json bun.lock src/main.tsx src/schema.ts src/zero/queries.ts api/routes/zero/get-queries.ts src/zero-preload.ts src/zero-client.ts
git commit -m "chore: upgrade Zero to <TARGET_VERSION>"
```
Stage only the files actually changed.

---

## Task 7: Re-run smoke verification on Zero `1.0.x`

**Files:**
- Optional Modify/Create: `docs/zero-smoke-checklist.md`

- [ ] **Step 1: Verify list page on upgraded app**

Open `http://localhost:3001/assets` (or the confirmed working UI port if changed).
Expected: rows render from live Zero data.

- [ ] **Step 2: Verify detail page on upgraded app**

Open a real asset detail route from the list page.
Expected: record details load without error.

- [ ] **Step 3: Verify chart rendering on upgraded app**

Expected: at least one chart visibly renders with non-empty data.

- [ ] **Step 4: Verify synced-query traffic and zero-cache health again**

Expected:
- successful `/api/zero/get-queries` requests
- no fatal zero-cache startup/query errors

- [ ] **Step 5: Run lint/build as final code-level verification**

Run:
```bash
cd /Users/yo_macbook/Documents/dev/zero-hono-before-tanstack-migration
bun run lint
bun run build
```
Expected: PASS.

- [ ] **Step 6: Commit any final fixups required by verification**

```bash
git add <changed files>
git commit -m "fix: complete Zero 1.x migration verification"
```
Only if verification required code changes.

---

## Task 8: Update essential docs to match the real working setup

**Files:**
- Modify: `README.md`
- Optional Modify: one or two focused docs only if needed

- [ ] **Step 1: Update README ports and startup commands**

Correct any mismatches for:
- UI port
- API port
- Zero cache URL
- `dev`, `dev:api`, `dev:ui`, `dev:zero-cache`
- any env examples that are now wrong

- [ ] **Step 2: Update README Zero version references**

Reflect the final upgraded `1.0.x` dependency and any changed setup notes.

- [ ] **Step 3: Add a concise troubleshooting note if needed**

Examples:
- how to verify API/query port alignment
- when to rebuild `@rocicorp/zero-sqlite3`
- what the expected dev ports are

Keep it short.

- [ ] **Step 4: Avoid broad historical-doc cleanup**

Only update docs that are essential for future runnability.

- [ ] **Step 5: Commit the docs updates**

```bash
git add README.md
git commit -m "docs: update Zero rescue and upgrade setup"
```
Include other doc files only if truly changed.

---

## Task 9: Capture a reusable checklist for scanning other Zero repos later

**Files:**
- Create: `docs/superpowers/specs/zero-repo-scan-checklist.md` or `docs/zero-repo-scan-checklist.md`

- [ ] **Step 1: Write the minimal discovery checklist**

Checklist must include:
- dependency scan: `@rocicorp/zero`
- script scan: `dev:zero-cache`
- env scan: `ZERO_*`, `VITE_PUBLIC_SERVER`, `VITE_ZERO_GET_QUERIES_URL`
- code scan: `ZeroProvider`, `useQuery`, `useZero`, `syncedQuery`

- [ ] **Step 2: Write the minimal validation checklist**

Checklist must include:
- confirm actual ports with `lsof`
- probe login and get-queries endpoints
- inspect browser network failures
- inspect zero-cache logs
- verify one list page, one detail page, one chart

- [ ] **Step 3: Keep it reusable and short**

No repo-specific history dump.

- [ ] **Step 4: Commit the checklist**

```bash
git add docs/zero-repo-scan-checklist.md
git commit -m "docs: add Zero repo scan checklist"
```
Adjust path if you save it elsewhere.

---

## Task 10: Final verification before claiming completion

**Files:**
- No required code changes

- [ ] **Step 1: Run final verification commands**

```bash
cd /Users/yo_macbook/Documents/dev/zero-hono-before-tanstack-migration
git status --short
bun run lint
bun run build
```
Expected: lint/build pass; working tree contains only intentional changes.

- [ ] **Step 2: Perform final manual smoke pass**

Verify:
- list page with data
- detail page with data
- chart visible
- synced-query traffic healthy

- [ ] **Step 3: Summarize exact final runtime contract**

Record:
- UI port
- API port
- Zero cache URL
- upgraded Zero version
- smoke route(s) used for proof

- [ ] **Step 4: Commit any final documentation or verification notes**

```bash
git add <intentional files>
git commit -m "docs: record final Zero runtime contract"
```
Only if needed.

- [ ] **Step 5: Stop and hand off for merge/review**

At this point the repo should be in a demonstrably working, documented, upgraded state.
