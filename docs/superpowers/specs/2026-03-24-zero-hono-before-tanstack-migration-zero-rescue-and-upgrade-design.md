# Design: Rescue and Upgrade Zero in `zero-hono-before-tanstack-migration`

Date: 2026-03-24
Repo: `/Users/yo_macbook/Documents/dev/zero-hono-before-tanstack-migration`
Status: Approved in brainstorming, pending written-spec review

## Summary

This pilot targets the `zero-hono-before-tanstack-migration` repository as the first repo-level Zero rescue and upgrade exercise inside `/Users/yo_macbook/Documents/dev`.

The repo currently appears to be a live Zero app on `@rocicorp/zero@0.24.3000000000`, with a UI that renders on port `3001` but shows no synced data or charts. PostgreSQL is confirmed to be running. The goal is to restore working data flow on the current Zero version first, then upgrade the repo to the latest stable Zero `1.0.x` release, then re-verify the app and update essential docs.

This pilot is also intended to produce a reusable evaluation and upgrade checklist for scanning other repos in the parent directory later.

## Goals

- Identify the root cause of the current blank-data / blank-chart behavior.
- Restore synced data and chart rendering on the current Zero version before any dependency upgrade.
- Upgrade `@rocicorp/zero` from `0.24.3000000000` to the latest stable `1.0.x` version.
- Update any code and configuration required for the `1.0.x` migration.
- Verify the restored and upgraded app through a focused smoke test.
- Update the repo's essential README/docs so ports, commands, and Zero wiring reflect reality.
- Capture a repeatable checklist for future Zero repo discovery and upgrades.

## Non-Goals

- Migrating this repo off Zero to TanStack DB.
- Redesigning the broader app architecture.
- Refactoring unrelated code paths.
- Cleaning all historical documentation or archive material.
- Scanning every repo under `/Users/yo_macbook/Documents/dev` during this pilot.

## Current Observations

From initial repo inspection:

- `package.json` includes `@rocicorp/zero: 0.24.3000000000`.
- Dev scripts still include `dev:zero-cache` and a 3-process `dev` workflow.
- `.env` contains:
  - `VITE_PUBLIC_SERVER='http://localhost:4848'`
  - `ZERO_UPSTREAM_DB="postgresql://user:password@127.0.0.1:5432/postgres"`
  - `ZERO_GET_QUERIES_URL="http://localhost:4001/api/zero/get-queries"`
  - `VITE_ZERO_GET_QUERIES_URL="http://localhost:4001/api/zero/get-queries"`
- `openspec/project.md` says the expected API dev server port is `4000` and Vite dev server port is `3003`.
- The user reports the UI is currently reachable on `3001`.
- The repo contains live Zero query definitions in `src/zero/queries.ts` and a synced-query endpoint at `api/routes/zero/get-queries.ts`.
- The repo history suggests a previously working state before migration away from Zero.

These observations strongly suggest the current failure is likely in runtime wiring rather than a total app removal of Zero.

## Problem Statement

The app shell renders, but synced data and chart content do not. Because the app is local-first and Zero-backed, this symptom most likely means at least one boundary in the data pipeline is failing:

1. browser to Zero synced-query endpoint
2. browser to zero-cache server
3. zero-cache to upstream PostgreSQL
4. synced query definitions to actual schema/data

The highest-probability current risk is configuration drift, especially around dev ports and Zero endpoint URLs. However, the implementation should not assume that; it should gather evidence and identify the first broken boundary before fixing anything.

## Recommended Approach

Use a two-stage approach:

1. **Rescue first**: restore the app on its existing Zero version.
2. **Upgrade second**: once the current app works, upgrade to the latest stable Zero `1.0.x`.

This is preferred over upgrading first because it cleanly separates:
- an existing runtime/configuration bug
- an upgrade-related regression

The rescue stage should use selective comparison against Rocicorp reference patterns, especially:
- `rocicorp/mono` Zero examples
- this repo's own previously working commits
- current Zero docs for synced queries and Zero client setup

## System Model

The implementation should treat the app as a 4-hop data pipeline:

### 1. Browser UI
React components render on the Vite dev server and call `useQuery(...)`.

### 2. Synced Query Resolution Endpoint
The frontend calls the synced-query endpoint configured via `VITE_ZERO_GET_QUERIES_URL`.

### 3. Zero Cache Server
The frontend also talks to the zero-cache server configured via `VITE_PUBLIC_SERVER`.

### 4. PostgreSQL Upstream
Zero cache reads from and syncs against `ZERO_UPSTREAM_DB`.

The debugging and verification strategy should identify the first boundary that fails, instead of applying speculative fixes.

## Work Breakdown

### Phase A — Baseline and Root-Cause Evidence

Purpose: determine exactly where the current data path breaks.

Tasks:
- Inspect runtime configuration and startup scripts.
- Confirm the effective ports for UI, API, and zero-cache.
- Inspect `src/main.tsx`, `src/zero-client.ts`, and `api/routes/zero/get-queries.ts`.
- Reproduce the blank-data state consistently.
- Gather evidence from:
  - browser console
  - browser network requests
  - API logs
  - zero-cache logs
  - direct endpoint checks against the synced-query route
- Compare against at least one known-good reference pattern before proposing a fix.

Expected output:
- a concise root-cause statement
- a short list of evidence proving the failing boundary

### Phase B — Restore App on Current Zero Version

Purpose: make the app work before upgrading dependencies.

Tasks:
- Fix the minimum necessary code/config issues to restore:
  - data loading in list/search views
  - data loading in detail views
  - chart rendering from live Zero-backed queries
- Avoid opportunistic refactors.
- Keep fixes tightly scoped to the diagnosed root cause(s).

Expected output:
- working Zero app on the current `0.24.x` version
- stable local dev workflow with correct port and env wiring

### Phase C — Upgrade to Zero `1.0.x`

Purpose: move the repo to the latest stable Zero major version.

Tasks:
- Confirm the actual target version (`1.0.0` or `1.0.1`).
- Review Zero release notes / migration guidance relevant to this repo's usage:
  - Zero client setup
  - React hooks imports/usages
  - synced queries
  - server endpoint helpers
  - zero-cache CLI / env assumptions
- Update dependencies and lockfile.
- Apply the smallest required compatibility changes.
- Re-run the baseline smoke path.

Expected output:
- repo upgraded to `@rocicorp/zero@1.0.x`
- app remains functional after upgrade

### Phase D — Essential Documentation Updates

Purpose: ensure the repo is understandable and runnable after the rescue + upgrade.

Tasks:
- Update README and only the most relevant docs to reflect:
  - actual dev ports
  - actual startup commands
  - current Zero endpoint configuration
  - any newly required migration notes
- Do not attempt a full historical-doc cleanup.

Expected output:
- docs that match the working system

### Phase E — Reusable Checklist for Other Repos

Purpose: turn this pilot into a repeatable method.

Tasks:
- Capture a short checklist for finding Zero repos in the parent directory using:
  - dependency signatures (`@rocicorp/zero`)
  - script signatures (`dev:zero-cache`)
  - env signatures (`ZERO_*`, `VITE_PUBLIC_SERVER`)
  - code signatures (`ZeroProvider`, `useQuery`, `syncedQuery`)
- Capture the minimal validation workflow used in this pilot.

Expected output:
- a reusable process for scanning the broader directory later

## Likely Failure Modes to Test

The implementation should explicitly test for these conditions:

- **Port mismatch**
  - frontend points at `4001`, but the API is actually on `4000` or elsewhere
- **Synced-query route mismatch**
  - `api/routes/zero/get-queries.ts` exists but is not mounted where the client expects
- **zero-cache not healthy**
  - process may be down, bound to another port, or failing startup
- **Upstream database or replica issue**
  - zero-cache cannot read from Postgres or cannot maintain the replica file
- **Schema/query incompatibility**
  - synced queries do not match live schema/data assumptions
- **Version-specific drift**
  - old 0.24 behavior or config conventions differ from what the repo currently expects

## Verification Strategy

### Baseline Rescue Verification
The app is considered rescued on the current Zero version only if all of the following are true:

- the UI renders real data, not just shell layout
- at least one search or table view returns records
- at least one detail view returns records
- at least one chart renders with live data
- the synced-query endpoint returns successful responses
- zero-cache is healthy and connected to Postgres

### Post-Upgrade Verification
The `1.0.x` upgrade is considered successful only if all of the above still hold after the dependency update, plus:

- `package.json` and lockfile reflect the target Zero version
- required code/config migration changes are applied
- essential README/docs describe the working setup accurately

## Testing Scope

This work does not require a full end-to-end test suite redesign. A focused smoke test is sufficient for the pilot.

Recommended smoke path:
- start required services
- load the UI
- verify a list/search page returns rows
- open one detail page
- verify one chart renders from live data
- confirm synced-query traffic is successful
- confirm zero-cache health/logs are clean enough for normal operation

If project test commands already exist and are lightweight, they can be run in addition to the smoke path, but the smoke path is the core acceptance gate.

## Risks and Mitigations

### Risk: Mixed root causes
If the repo has both a current runtime bug and an upgrade migration issue, debugging can become ambiguous.

Mitigation:
- do not upgrade until the app works on the old version

### Risk: Docs and env drift
The repo may contain conflicting guidance about ports and Zero settings.

Mitigation:
- treat running code and observed process bindings as authoritative
- update only essential docs after the working state is confirmed

### Risk: Zero `1.0.x` introduces breaking changes
The major-version upgrade may require code changes beyond a version bump.

Mitigation:
- compare this repo's actual Zero surface area against current migration guidance before editing
- keep upgrade changes scoped and verify immediately after

### Risk: Historical fixes may have left partial migrations
The repo contains several fix summaries and migration notes that may not match the live code.

Mitigation:
- prioritize live code, env, startup scripts, and runtime evidence over historical markdown

## Deliverables

The pilot should produce:

1. a restored working app on the existing Zero version
2. a verified upgrade to Zero `1.0.x`
3. essential README/doc updates matching the real setup
4. a concise reusable checklist for identifying and upgrading other Zero repos in the directory

## Implementation Guidance for the Next Planning Step

The subsequent implementation plan should be organized in this order:

1. reproduce and log the blank-data failure
2. confirm effective runtime ports and endpoint wiring
3. identify the first failing boundary in the Zero data path
4. repair the current-version app with the minimum viable fix
5. verify rescued baseline
6. upgrade to latest stable Zero `1.0.x`
7. apply any required migration fixes
8. re-verify smoke path
9. update essential docs
10. extract reusable repo-scan checklist
