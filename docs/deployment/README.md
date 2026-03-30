# Production Deployment And Rebuild Runbook

This document is the detailed record of how this app was deployed to the VPS, what went wrong, what was fixed, and how to rebuild the stack from zero without repeating the same mistakes.

It covers:

- VPS preparation
- repo checkout and env placement
- Postgres ownership cutover
- Bun/Hono app deployment
- Zero deployment
- Caddy / ingress
- every deployment error that was observed during the first rollout
- every fix that was applied
- what still needs tightening
- the safest future sequence for adding, changing, or removing Zero-synced tables
- how to reduce downtime for Postgres and Zero

This is the main recovery document to use before wiping production and rebuilding it.

## Canonical Inputs

Official references that informed the deployment shape:

- Zero deployment: <https://zero.rocicorp.dev/docs/deployment>
- Zero Postgres requirements: <https://zero.rocicorp.dev/docs/connecting-to-postgres>
- Zero config: <https://zero.rocicorp.dev/docs/zero-cache-config>
- Zero Postgres feature constraints: <https://zero.rocicorp.dev/docs/postgres-support>
- Zero auth / permissions: <https://zero.rocicorp.dev/docs/auth>
- Hono docs: <https://hono.dev/llms-full.txt>
- Bun docs: <https://bun.sh/llms.txt>

Local repo inputs that define the current production contract:

- `infra/prod/docker-compose.yml`
- `infra/prod/.env.example`
- `infra/prod/scripts/deploy.sh`
- `infra/prod/scripts/apply-postgres-bootstrap.sh`
- `infra/prod/scripts/deploy-zero-permissions.sh`
- `infra/prod/scripts/healthcheck.sh`
- `infra/prod/scripts/render-caddyfile.sh`
- `infra/prod/scripts/inspect-current-postgres.sh`
- `infra/prod/sql/verify-zero-readiness.sql`
- `docker/migrations/0008_move_shared_tables_to_namespaces.sql`
- `docker/migrations/0009_create_zero_app_publication.sql`
- `docker/migrations/0010_enable_investor_activity_zero_sync.sql`
- `Dockerfile`
- `.github/workflows/deploy.yml`

Companion repo inputs that matter because they shape the Postgres tables consumed by this app:

- `/Users/yo_macbook/Documents/dev/sec_app/src/sec_app/pipeline/db_creation_utils.py`
- `/Users/yo_macbook/Documents/dev/sec_app/docs/VPS_DEPLOYMENT_GUIDE.md`
- `/Users/yo_macbook/Documents/dev/sec_app/IMPLEMENTATION_NOTES.md`

## What Was Actually Deployed

The final deployed shape was:

- one existing VPS
- one shared Postgres container using `mooncakelabs/pg_mooncake:18-v0.2-preview`
- one Bun/Hono app container serving both UI and API
- one single-node `zero-cache` container
- one Caddy reverse proxy in front
- one shared Postgres volume preserved across ownership cutover

The official Zero docs recommend starting with a single-node topology, colocating services in one region, keeping the SQLite replica on fast persistent disk, and using a direct `ZERO_UPSTREAM_DB` connection for replication. That matches this repo's final shape. See:

- <https://zero.rocicorp.dev/docs/deployment>
- <https://zero.rocicorp.dev/docs/connecting-to-postgres>
- <https://zero.rocicorp.dev/docs/zero-cache-config>

## Important Reality: Intended Architecture vs Actual First Rollout

The repo originally described a cleaner target than what the VPS actually allowed on day one.

Target architecture in repo:

- host-level Caddy installed as a service
- production env file in `/etc/fintellectus/react-hono-zero-pg-main.env`
- deploy script using `sudo systemctl reload caddy`
- default app bind port `3000`

What the first successful rollout actually used:

- `sec_deploy` user on the VPS
- no passwordless sudo available
- no root SSH
- no host-level Caddy install possible non-interactively
- repo checkout at `/opt/dev/erudio_app/react-hono-zero-pg-main`
- production env file stored in the repo checkout as `.env.prod`
- Dockerized Caddy used as a workaround for ingress
- app bind port changed to `3100` because `127.0.0.1:3000` was already in use on the VPS
- temporary IP-based public access because no real domain existed yet
- same-origin Zero fallback at `/zero` because a separate public Zero port was not reachable externally

This mismatch matters. If you rebuild production, do not assume the repo defaults exactly match the VPS privileges or occupied ports. Run preflight checks first.

One historical gap to be explicit about:

- the exact one-off `docker run` invocation that launched the first working Caddy container was not preserved as a repo-managed artifact

What is preserved:

- the rendered Caddy behavior
- the routing model
- the reason Dockerized Caddy was used
- the repo changes needed to support `/zero` path proxying

What is not preserved precisely enough:

- the exact manual container launch command, mounts, and restart command sequence

That is why the next rebuild should not rely on memory for Caddy. Encode it in compose first, or install host-level Caddy properly.

## Final Working Deployment Inventory

At the end of the rollout, the important production facts were:

- VPS IP: `206.168.212.173`
- SSH user: `sec_deploy`
- repo checkout: `/opt/dev/erudio_app/react-hono-zero-pg-main`
- live Postgres container name: `sec_postgres_18`
- Postgres image: `mooncakelabs/pg_mooncake:18-v0.2-preview`
- preserved Postgres volume: `sec_app_sec_pgdata`
- Bun/Hono app container: `fintellectus_app`
- Zero container: `fintellectus_zero_cache`
- Caddy container: `fintellectus_caddy`
- public app URL: `http://206.168.212.173/`
- public Zero URL during IP-only mode: `http://206.168.212.173/zero`

The app became reachable without a domain by using one public origin and path-based Zero proxying.

## Final Application Routing

In the temporary IP-only setup:

- `/` -> Bun/Hono app
- `/api/*` -> Bun/Hono API
- `/zero/*` -> `zero-cache`
- `/healthz` -> app health
- `/zero/keepalive` -> Zero health

This was chosen because exposing a separate public Zero port did not work from the internet.

## Why The Architecture Ended Up This Way

For this repo:

- the frontend is a built SPA
- Hono/Bun serves the built assets and API from one process
- Zero is a separate stateful service and should stay separate
- Postgres already existed and contained shared pipeline data

That means the natural production split is:

- app service: Bun/Hono
- sync service: Zero
- database service: Postgres
- ingress service: Caddy

## Chronological Record Of The First Deployment

This is the exact sequence that led to a working production deployment.

### 1. Confirm the repo state

- local working tree was cleaned up
- local `main` was ahead of `origin/main` at first
- changes were pushed so deployment would use the real intended revision

Reason:

- the deploy flow on the VPS is pull-based
- if local commits are not pushed, the VPS deploys stale code

### 2. Inspect the VPS reality before changing anything

Confirmed:

- SSH worked as `sec_deploy`
- Docker and git were installed
- root SSH was blocked
- passwordless sudo was not available
- existing Postgres was already running
- Caddy was not installed on the host
- `docker` access was available

Critical discovery:

- Postgres was already live, so "deploying Postgres" meant taking ownership of an existing container and volume, not creating a fresh empty database

### 3. Inspect the existing Postgres deployment

The inspection established:

- container name: `sec_postgres_18`
- image lineage: `mooncakelabs/pg_mooncake:18-v0.2-preview`
- volume to preserve: `sec_app_sec_pgdata`
- bind: `127.0.0.1:5432`
- `wal_level` was already `logical`

This was the best possible starting state for Zero. No Postgres version switch was needed, and the existing image family could be preserved.

### 4. Decide how to expose the app without a real domain

Because no public DNS names existed yet:

- public access used the raw VPS IP
- the app used the IP as the public origin
- Zero initially tried to use a separate port, then moved behind `/zero`

The chosen temporary public model was:

- app origin: `http://206.168.212.173`
- Zero origin after fallback: `http://206.168.212.173/zero`

### 5. Put the repo on the VPS

The repo checkout was created at:

- `/opt/dev/erudio_app/react-hono-zero-pg-main`

The repo became the source of truth for:

- the shared Postgres definition
- the Bun app
- Zero
- prod verification SQL
- deploy scripts

### 6. Create the production env file

Because `/etc/...` was not writable without sudo, the first successful rollout used a repo-local env file on the VPS instead of the intended path in `infra/prod/README.md`.

This was a practical compromise, not the ideal steady state.

### 7. Discover a port conflict on `127.0.0.1:3000`

Problem:

- app default bind port `3000` was already occupied on the VPS

Fix:

- moved the app bind to `3100` for the live rollout

Prevention:

- add a preflight that fails clearly if configured bind ports are already in use

### 8. Render and apply Caddy config

First failure:

- Caddy config used `versions h1_1`
- Caddy rejected that syntax

Fix:

- changed it to `versions 1.1`

Repo evidence:

- `infra/prod/Caddyfile.template`
- commit `7dd39b5`

### 9. Work around missing host-level Caddy

Problem:

- repo deploy script assumed `sudo systemctl reload caddy`
- the VPS did not allow that path
- Caddy was not installed on the host

Fix:

- used a Dockerized Caddy container for the first working rollout

Important note:

- this workaround is not fully encoded in the repo today
- the repo still assumes host-level Caddy in `infra/prod/scripts/deploy.sh`

This is one of the most important rebuild risks to close before the next wipe.

### 10. Cut over ownership of Postgres without losing the data volume

Action:

- stopped and removed the old Postgres container owner
- started the repo-managed `postgres` service against the same existing volume

What did not happen:

- no volume drop
- no reseed
- no rebuild of production data from scratch

This was the key "ownership cutover" move.

### 11. Apply shared Postgres bootstrap SQL

This reapplied the idempotent SQL needed for the app:

- extensions
- namespaced schema moves
- publication creation
- drilldown function
- Zero-safe investor activity key migration

### 12. Hit a dangerous long-running migration

Problem:

- the earlier bootstrap path included `docker/migrations/0004_ensure_zero_sync_key.sql`
- that migration touched `public.cusip_quarter_investor_activity_detail`
- that detail table is large enough to make this default path unsafe in production
- the backend had to be terminated manually during that attempt

Root cause:

- `0004` was too broad for a default shared-prod bootstrap path
- the app only needed the smaller aggregated `serving.cusip_quarter_investor_activity` table fixed for Zero

Fix:

- removed `0004` from `infra/prod/scripts/apply-postgres-bootstrap.sh`
- created a smaller, focused migration `docker/migrations/0010_enable_investor_activity_zero_sync.sql`

Repo evidence:

- `infra/prod/scripts/apply-postgres-bootstrap.sh`
- `docker/migrations/0010_enable_investor_activity_zero_sync.sql`
- commits `abbaaf4`, `4dfe842`

### 13. Fix the schema namespace mismatch

Problem:

- the app expected namespaced tables like `serving.*` and `app_state.user_counters`
- production initially had tables in `public`

Fix:

- applied `docker/migrations/0008_move_shared_tables_to_namespaces.sql`
- set:

```sql
ALTER ROLE "user" IN DATABASE postgres
SET search_path = serving, app_state, public;
```

Why this mattered:

- the app could use explicit namespaced relations
- the existing pipeline could still rely on unqualified SQL resolving correctly

### 14. Create and verify the Zero publication

Action:

- applied `docker/migrations/0009_create_zero_app_publication.sql`
- verified publication `zapp_app`

Why:

- Zero should not rely on the default "all tables in public schema" publication
- this repo needs explicit control over what is replicated

Official Zero guidance:

- custom publications are a first-class supported path
- if the role cannot create publications, create one manually and set `ZERO_APP_PUBLICATIONS`

See:

- <https://zero.rocicorp.dev/docs/connecting-to-postgres>
- <https://zero.rocicorp.dev/docs/zero-cache-config>

### 15. Start app and Zero

Once Postgres was healthy and bootstrapped:

- app was started
- `zero-cache` was started

Internal health:

- app `/healthz` succeeded
- Zero `/keepalive` succeeded

### 16. Discover that the public Zero port was not reachable

Problem:

- the separate public Zero port timed out from the public internet

Likely cause:

- upstream firewall or host network exposure problem

Fix:

- introduced same-origin Zero fallback with `ZERO_PATH_PREFIX=/zero`
- made Caddy proxy `/zero/*` to the internal Zero port

Repo evidence:

- `infra/prod/scripts/render-caddyfile.sh`
- commit `d12dcf1`

This was the correct temporary solution for an IP-only deploy.

### 17. Hit a browser-only runtime error on plain HTTP/IP

Problem:

- the app used `crypto.randomUUID()`
- on plain HTTP over raw IP, the runtime did not provide it
- public browser flow failed with `TypeError: crypto.randomUUID is not a function`

Fix:

- added a compatibility helper
- `src/main.tsx` now uses `randomUUIDCompat()`

Repo evidence:

- `src/lib/random-id.ts`
- `src/lib/random-id.test.ts`
- `src/main.tsx`
- commit `3e6c47c`

### 18. Hit a Zero schema incompatibility on investor activity

Problem:

- Zero rejected `serving.cusip_quarter_investor_activity`
- the table did not have a database-level primary key or non-null unique index
- one unsupported table in `src/schema.ts` can poison the whole client connection

Root cause:

- the pipeline creates this table with `DROP TABLE ... CREATE TABLE AS`
- that pattern recreates data but discards constraints unless they are re-added
- in `sec_app`, `db_creation_utils.py` uses:

```sql
DROP TABLE IF EXISTS cusip_quarter_investor_activity;
CREATE TABLE cusip_quarter_investor_activity AS
SELECT
  ROW_NUMBER() OVER (...) AS id,
  ...
```

That produced an `id` column with usable values, but not a real Postgres primary key.

### 19. Use a temporary app-level mitigation to restore availability

Immediate mitigation:

- removed `serving.cusip_quarter_investor_activity` from the Zero client schema
- removed investor-activity queries and preloads
- showed a fallback message instead of charts

Goal:

- recover the rest of the app quickly

Repo evidence:

- commit `abbaaf4`

### 20. Investigate the real table before choosing the permanent fix

Important discovery:

- the problematic table was the smaller aggregated table, not the much larger detail table
- `serving.cusip_quarter_investor_activity` was around `1.15M` rows
- `id` had no nulls
- `id` was distinct
- it simply lacked a PK and `NOT NULL`

That meant the right fix was not to disable the feature permanently. The right fix was to harden the database table.

### 21. Apply the permanent Zero-safe key fix

Fix:

- created `docker/migrations/0010_enable_investor_activity_zero_sync.sql`
- made `serving.cusip_quarter_investor_activity.id` `NOT NULL`
- made `id` the primary key

Also updated:

- `infra/prod/sql/verify-zero-readiness.sql`

That verification now explicitly fails if the table lacks a primary key or publication membership.

### 22. Restore the investor activity UI

After the database fix:

- re-added the table to the client schema
- restored Zero queries
- restored the charts on asset detail

Repo evidence:

- `src/schema.ts`
- `src/zero/queries.ts`
- `src/components/GlobalSearch.tsx`
- `src/pages/AssetDetail.tsx`
- tests in `src/schema.test.ts` and `src/zero/queries.test.ts`
- commit `4dfe842`

### 23. Hit the Zero permissions deployment problem

Problem:

- `zero-cache` warned that permissions were not deployed upstream
- `zero-deploy-permissions` could not be run reliably in the Bun runtime path
- the host only had Node `18.x`
- the CLI path needed a supported Node runtime

Official Zero docs note that production permissions deployment should be part of the deploy process. See:

- <https://zero.rocicorp.dev/docs/auth>

Fix:

- added a dedicated `permissions-runtime` Docker stage on `node:24-bookworm-slim`
- added a `permissions` service to the prod compose
- added `infra/prod/scripts/deploy-zero-permissions.sh`
- wired that into `infra/prod/scripts/deploy.sh`

Repo evidence:

- `Dockerfile`
- `infra/prod/docker-compose.yml`
- `infra/prod/scripts/deploy-zero-permissions.sh`

### 24. Introduce and then fix an app image regression

Problem:

- after adding the permissions runner, the wrong Dockerfile stage became the effective default app image
- the app container started the permissions help command instead of the Bun server
- the app restarted repeatedly
- Zero saw transform failures and 502s against the app

Fix:

- moved `runtime` back to the final Dockerfile stage
- explicitly set `target: runtime` for the app in `infra/prod/docker-compose.yml`

Repo evidence:

- commit `21a97f8`

### 25. Verify the final live system

Final verification included:

- app root loaded publicly
- `/healthz` returned `200`
- `/zero/keepalive` returned `200`
- public browser flow passed
- search worked
- asset detail worked
- charts were visible again
- browser console errors were empty
- page errors were empty
- Zero logs no longer showed the investor-activity schema failure in the final run

## Every Observed Error And Its Fix

| Error / Symptom | Root Cause | Fix Applied | Prevention / Automation |
|---|---|---|---|
| Local code was ahead of `origin/main` before deploy | Pull-based VPS deploy would use stale code | Push local commits before deploy | Add a local pre-deploy check that fails if `HEAD` is ahead of `origin/main` |
| No repo checkout on VPS | Repo had never been deployed there | Clone repo to `/opt/dev/erudio_app/react-hono-zero-pg-main` | Add a bootstrap script that creates the checkout if missing |
| Env file missing on VPS | Production config was not installed yet | Created a VPS env file manually | Add `install-prod-env.sh` and explicit path validation |
| Host-level Caddy missing | VPS lacked installed service and sudo path | Used Dockerized Caddy as workaround | Encode Caddy mode in repo: `host` or `docker` |
| `sudo systemctl reload caddy` not usable | `sec_deploy` had no passwordless sudo | Avoided host reload path in practice | Add preflight that detects sudo capability before deploy |
| `127.0.0.1:3000` occupied | Existing process already bound there | Moved app bind to `3100` on the live VPS | Add port availability preflight |
| Caddy rejected `versions h1_1` | Invalid Caddy syntax | Changed to `versions 1.1` | Add `caddy validate` to deploy pipeline |
| Default prod docs assumed `/etc/...` env path | VPS user could not write there | Used repo-local `.env.prod` on first rollout | Parameterize env path and validate write access |
| Public Zero port timed out | Separate public port was not reachable externally | Switched to same-origin `/zero` path proxy | Prefer `/zero` fallback whenever no real domain exists |
| `crypto.randomUUID` missing on public HTTP/IP | Browser runtime on non-secure origin lacked that API path | Added `randomUUIDCompat()` | Keep browser-safe fallback for client IDs |
| Bootstrap migration against huge detail table ran too long | `0004_ensure_zero_sync_key.sql` was too heavy for default prod bootstrap | Removed `0004` from prod bootstrap; added focused `0010` migration | Maintain a "shared-prod-safe" bootstrap list separate from fresh-init mounts |
| App expected `serving.*`, prod still had `public.*` | Schema namespace drift | Applied `0008_move_shared_tables_to_namespaces.sql` and set role `search_path` | Add namespace verification to preflight and bootstrap |
| Zero schema incompatibility on `serving.cusip_quarter_investor_activity` | Table had no database-level PK despite `id` values existing | Added `0010_enable_investor_activity_zero_sync.sql`; restored client schema | Never add a table to `src/schema.ts` before PK verification passes |
| Investor activity charts had to be disabled temporarily | App depended on an unsyncable table | Removed table/queries/charts temporarily, then restored after DB fix | Use a progressive rollout sequence: DB first, app schema second |
| Zero permissions missing upstream | Production deploy never ran supported permissions CLI | Added Node 24 permissions runner and deploy script | Make permissions deployment a mandatory deploy step |
| App container restarted showing permissions help text | Wrong Dockerfile stage was built for the app | Restored final `runtime` stage and explicit compose build target | Add container command smoke check after build |
| Zero transform failures / 502s | App was down because wrong image stage was running | Fixed app image target and redeployed | Add deploy gate that verifies `/healthz` before starting Zero |

## What The Repo Currently Automates

Already automated in this repo:

- pull latest `main` on the VPS
- compose config validation
- image build for app and permissions
- start Postgres first
- apply idempotent shared Postgres bootstrap SQL
- verify Zero readiness with SQL
- run Zero permissions deployment
- start app and Zero
- render Caddy config
- run internal and optional public health checks

Automation entry points:

- `infra/prod/scripts/deploy.sh`
- `infra/prod/scripts/apply-postgres-bootstrap.sh`
- `infra/prod/scripts/deploy-zero-permissions.sh`
- `infra/prod/scripts/healthcheck.sh`
- `infra/prod/scripts/render-caddyfile.sh`
- `infra/prod/scripts/inspect-current-postgres.sh`
- `.github/workflows/deploy.yml`

## What Is Still Not Automated Enough

These should be tightened before wiping production.

### 1. Caddy mode is not explicit

Current problem:

- repo assumes host-level Caddy
- actual successful rollout used Dockerized Caddy

Recommended fix:

- add `CADDY_MODE=host` or `CADDY_MODE=docker`
- support both in deploy scripts
- if `host`, validate `sudo` and `systemctl`
- if `docker`, define Caddy in compose instead of as a one-off manual container

### 2. Port preflight is missing

Add a preflight that checks:

- `5432`
- app bind port
- Zero bind port
- any Caddy host bindings if Dockerized

Fail before any compose action if ports are already occupied unexpectedly.

### 3. Env path and writeability are not preflighted

Add checks for:

- env file exists
- env file readable
- deploy user can read it
- Caddy output path writable or docker-mounted

### 4. Public reachability is not checked early enough

Add a staged public reachability check:

- before switching traffic
- after app only
- after Zero path routing

This would have caught the dead public Zero port earlier.

### 5. Caddy config validation is missing from the scripted path

Add:

```bash
caddy validate --config <rendered-file>
```

or, if Caddy stays containerized:

```bash
docker run --rm -v "$PWD/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2 caddy validate --config /etc/caddy/Caddyfile
```

### 6. Browser smoke tests should run after deploy automatically

Minimum browser smoke flow:

- load `/`
- verify no console errors
- open assets page
- search `AMIX`
- click result
- verify asset detail renders
- verify no page errors

### 7. Shared Postgres volume identity should be formalized

The production cutover depended on reusing an existing named volume. That should be explicit and documented as an external ownership contract if possible.

### 8. The initdb path and the existing-volume bootstrap path are not perfectly aligned

Important mismatch:

- `infra/prod/scripts/apply-postgres-bootstrap.sh` intentionally excludes `0004_ensure_zero_sync_key.sql`
- but `infra/prod/docker-compose.yml` still mounts `0004_ensure_zero_sync_key.sql` in `docker-entrypoint-initdb.d`

That means:

- fresh empty-volume initialization and existing-volume bootstrap do not follow the same safe path

Recommendation:

- split "fresh database initialization" from "existing shared production bootstrap" more explicitly
- keep heavy DDL off the default fresh-init path unless it is proven safe

## Rebuild Procedure For A Fresh VPS

This is the recommended sequence if the VPS itself is being rebuilt.

### 1. Provision the host

At minimum:

- create `sec_deploy`
- install Docker and git
- configure SSH keys
- disable root login after confirming `sec_deploy` access

If you want host-level Caddy:

- install Caddy
- grant the exact minimum sudo path needed to update config and reload it

If you do not want host-level Caddy:

- standardize on Dockerized Caddy and encode it in repo compose

### 2. Prepare directories

Create:

- `/opt/dev/erudio_app`
- `/opt/dev/erudio_app/app_data`
- `/opt/dev/erudio_app/react-hono-zero-pg-main`

### 3. Clone the repo

Use:

```bash
git clone <repo-url> /opt/dev/erudio_app/react-hono-zero-pg-main
cd /opt/dev/erudio_app/react-hono-zero-pg-main
git checkout main
git pull --ff-only origin main
```

### 4. Install the production env file

Recommended long-term location:

- `/etc/fintellectus/react-hono-zero-pg-main.env`

Fallback if sudo is unavailable:

- `/opt/dev/erudio_app/react-hono-zero-pg-main/.env.prod`

Populate at least:

- compose identity
- app bind host/port
- Zero bind host/port
- public URLs
- Postgres credentials
- Zero credentials
- app deploy path

If no real domain exists yet:

- set `APP_PUBLIC_URL` to the public IP origin
- set `ZERO_PATH_PREFIX=/zero`
- set `ZERO_PUBLIC_URL` to the same public origin plus `/zero`

### 5. Decide your ingress mode before proceeding

Use one of these two modes.

Mode A: host-level Caddy

- recommended only if sudo path is reliable
- use `render-caddyfile.sh`
- validate Caddy config
- reload Caddy service

Mode B: Dockerized Caddy

- recommended if the deploy user cannot manage host services
- run Caddy as a declared container, not a one-off manual command
- keep the same rendered config contract

### 6. If reusing an existing Postgres volume, inspect before cutover

Run:

```bash
bash infra/prod/scripts/inspect-current-postgres.sh <env-file>
```

Confirm:

- container name
- image family
- mounted volume
- bind ports
- `wal_level=logical`
- extensions present
- publication status

### 7. If starting from a truly new empty database

Important:

- fresh empty DB and existing shared DB are not the same procedure
- if the database is seeded by the pipeline, do not assume entrypoint init SQL alone is enough

Recommended order:

1. start Postgres
2. run pipeline data load or restore data
3. apply repo-owned bootstrap SQL
4. verify readiness
5. deploy permissions
6. start app and Zero

### 8. Bring up Postgres first

Run:

```bash
docker compose --env-file <env-file> -f infra/prod/docker-compose.yml up -d postgres
```

Wait for health.

### 9. Apply the shared bootstrap SQL

Run:

```bash
bash infra/prod/scripts/apply-postgres-bootstrap.sh <env-file>
```

This must succeed before app or Zero are declared ready.

### 10. Deploy Zero permissions

Run:

```bash
bash infra/prod/scripts/deploy-zero-permissions.sh <env-file>
```

This should stay part of every production deploy until the repo moves off the current permissions model.

### 11. Start app and Zero

Run:

```bash
docker compose --env-file <env-file> -f infra/prod/docker-compose.yml up -d app zero-cache
```

### 12. Apply ingress config

Render Caddy:

```bash
OUTPUT_PATH=<target-caddyfile> bash infra/prod/scripts/render-caddyfile.sh <env-file>
```

Then either:

- reload host-level Caddy
- or restart/reload Dockerized Caddy

### 13. Run health checks

Run:

```bash
CHECK_PUBLIC_ENDPOINTS=1 bash infra/prod/scripts/healthcheck.sh <env-file>
```

### 14. Run a browser smoke test

Do not stop at curl-only checks.

Confirm in a real browser:

- landing page loads
- no console errors
- no page errors
- search returns results
- clicking result navigates correctly
- charts and tables render

## Existing Postgres Ownership Cutover Procedure

Use this when the DB already exists and must be preserved.

### 1. Inspect current reality

Before stopping anything, capture:

- current container name
- current image
- current volume names
- bind ports
- `SHOW wal_level`
- installed extensions
- publications

### 2. Confirm image compatibility

For this app, do not switch away from the `pg_mooncake` lineage during the ownership cutover. Keep the same family unless there is a deliberate migration plan.

### 3. Confirm the volume name

This is the non-negotiable asset to preserve.

### 4. Stop only the old Postgres owner

Do not remove the volume.

### 5. Start repo-managed Postgres against the same volume

This is the handoff point where this repo becomes the production owner.

### 6. Apply the bootstrap SQL immediately after cutover

This aligns the DB with app and Zero expectations.

### 7. Verify readiness before starting traffic

Run the repo-owned verification SQL before app and Zero are trusted.

## Safe Sequence For Future Table Adds, Changes, And Removals

This is the most important operational rule set in this document.

### Rule 1: Decide whether a table is Zero-synced before app code references it

Do not add a table to `src/schema.ts` because it "looks like it has an id". Verify the live Postgres table first.

Before a table enters `src/schema.ts`, prove:

- it is a real base table, not a view
- row identity is stable
- primary key exists, or at minimum a non-null unique index
- the key column has no nulls
- the key column has no duplicates
- the table is included in the publication
- any unsupported types are accounted for

### Rule 2: Never use `DROP TABLE ... CREATE TABLE AS` on a live Zero-synced table without a post-step that recreates constraints

This is how the investor activity failure happened.

For Zero-synced tables, prefer:

1. build a staging table
2. validate the staging table
3. add PK / `NOT NULL` / indexes on the staging table
4. include it in the publication if needed
5. swap it into place in a controlled step

Do not rely on CTAS preserving constraints. It does not.

### Rule 3: Database first, app schema second

Add or change the Postgres table first.

Only after the DB is proven Zero-safe should the app be updated to use it.

The safe order is:

1. implement or update the pipeline output table
2. preserve or recreate constraints at the database level
3. apply migration to staging or production DB
4. update publication if needed
5. run readiness SQL
6. deploy Zero permissions if schema/auth changes require it
7. then add the table to `src/schema.ts`
8. then deploy the app

### Rule 4: Treat publication changes as deployment events

Official Zero docs note that changing publications can trigger replica resync and downtime. They also note that after adding a table to a publication, existing rows may need an innocuous `UPDATE` to stream pre-existing data.

See:

- <https://zero.rocicorp.dev/docs/zero-cache-config>
- <https://zero.rocicorp.dev/docs/postgres-support>

For publication changes:

1. update the publication
2. do the required backfill / innocuous update if needed
3. expect replica churn
4. schedule carefully

### Rule 5: Removal should be two-phase

Do not drop a table from Postgres before the app stops referencing it.

Safe removal order:

1. remove UI dependency
2. remove query/preload dependency
3. remove table from `src/schema.ts`
4. deploy app and Zero
5. confirm no runtime references remain
6. then contract the publication and database

### Rule 6: Column additions must follow Zero's Postgres rules

Official Zero docs warn that adding a column with a non-constant default is not supported as a direct change. The safe pattern is:

1. add the column without the default
2. backfill values
3. then set the default

See:

- <https://zero.rocicorp.dev/docs/postgres-support>

## Recommended Dev-To-Prod Sequence For Any Zero-Synced Schema Change

Use this sequence every time.

1. Decide whether the new table or column should be Zero-synced at all.
2. Update the pipeline or migration logic to build the target table safely.
3. Add database-level PK / `NOT NULL` / indexes explicitly.
4. Validate row identity with SQL.
5. Update the publication if needed.
6. Update `infra/prod/sql/verify-zero-readiness.sql` so production enforces the invariant.
7. Add or update tests in this repo around `src/schema.ts` and query usage.
8. Run local dev with `bun run dev`.
9. If Zero behaves strangely locally, reset the local replica with `bun run zero:reset`.
10. Deploy DB-side change first.
11. Run readiness SQL on production.
12. Deploy permissions if schema/auth rules changed.
13. Deploy app and Zero.
14. Run browser smoke tests against production.
15. Only then declare the change complete.

## Downtime: What Can And Cannot Be Avoided

### Zero

With the current single-node Zero topology, some deploy-time disruption is normal. The official Zero docs position single-node as the simplest starting point, but not as a zero-downtime rolling topology.

Realistic guidance:

- config changes can restart Zero
- publication changes can resync the replica
- replica rebuilds can temporarily increase lag or cause downtime

If true near-zero-downtime Zero deploys become a requirement later, move to the multi-node topology described in the Zero docs. That is not today's shape.

### Postgres

You can reduce, but not entirely eliminate, database deployment risk.

Prefer:

- additive schema changes
- concurrent index creation when possible
- staged backfills
- staging-table swap patterns
- avoiding `DROP TABLE` on hot tables

Avoid:

- heavy DDL on very large live tables as part of the default deploy path
- rebuilding large Zero-synced tables in place during peak traffic

### App

The app can usually restart faster than Zero or Postgres. The main risk is deploying an app revision that points at schema or query contracts not yet live in Postgres.

That is why the order must stay:

- Postgres readiness first
- permissions next
- app and Zero last

## Suggested Improvements Before The Next Production Wipe

Priority order:

### 1. Encode Caddy explicitly in repo

Choose one:

- make host-level Caddy the supported path and grant the exact minimal sudo capability
- or move Caddy into compose and stop pretending host-level reload is always available

Do not keep the current ambiguity.

### 2. Add a single `prod-preflight.sh`

It should fail fast on:

- missing repo checkout
- missing env file
- missing required commands
- no Docker access
- port conflicts
- missing sudo for chosen ingress mode
- unwritable Caddy output path
- unsupported Node path for permissions if Docker build is skipped

### 3. Strengthen `healthcheck.sh`

Add:

- retry loops with backoff
- check that `ZERO_QUERY_URL` returns successfully from the Zero container's perspective
- fail if app health is not stable before Zero startup

### 4. Add browser smoke automation to CI/CD

Minimum production smoke should run automatically after deploy and should gate the deploy as failed if:

- console errors appear
- page errors appear
- asset search flow fails

### 5. Separate "fresh DB init" from "existing shared DB bootstrap"

These are different procedures and should not share one ambiguous migration list.

### 6. Add an explicit SQL identity verifier per Zero table

For each Zero-synced table, keep a production check for:

- table exists
- PK exists
- publication membership exists

### 7. Consider migrating off deprecated Zero permissions

Zero's docs mark the older permissions model as deprecated and note it will be removed in a future release. Do not rip it out during rebuild, but do track this as a future migration item so the deploy path does not calcify around a deprecated interface.

See:

- <https://zero.rocicorp.dev/docs/auth>

### 8. Make the deploy script support staged rollouts

Suggested stages:

- `postgres-only`
- `bootstrap-only`
- `permissions-only`
- `app-only`
- `zero-only`
- `full`

This makes recovery less blunt during incidents.

## Commands That Matter Most

Inspect existing Postgres:

```bash
bash infra/prod/scripts/inspect-current-postgres.sh <env-file>
```

Apply shared bootstrap:

```bash
bash infra/prod/scripts/apply-postgres-bootstrap.sh <env-file>
```

Deploy Zero permissions:

```bash
bash infra/prod/scripts/deploy-zero-permissions.sh <env-file>
```

Run the full deploy:

```bash
PROD_ENV_FILE=<env-file> bash infra/prod/scripts/deploy.sh
```

Run health checks:

```bash
CHECK_PUBLIC_ENDPOINTS=1 bash infra/prod/scripts/healthcheck.sh <env-file>
```

## Verification Checklist For A Rebuild

Do not sign off a rebuild until all of this is true.

- Postgres starts on the preserved or intended volume
- `SHOW wal_level` returns `logical`
- `pg_duckdb` exists
- `pg_mooncake` exists
- `serving.assets` exists
- `serving.superinvestors` exists
- `serving.cusip_quarter_investor_activity` exists
- `serving.cusip_quarter_investor_activity` has a primary key
- `app_state.user_counters` exists
- publication `zapp_app` exists
- publication includes `serving.assets`
- publication includes `serving.cusip_quarter_investor_activity`
- app `/healthz` returns `200`
- Zero `/keepalive` returns `200`
- public app page loads
- public asset search works
- public asset detail works
- no browser console errors
- no browser page errors

## Commits That Correspond To The Major Production Fixes

- `7dd39b5` `Fix Caddy zero proxy HTTP version`
- `d12dcf1` `Support same-origin Zero fallback for IP deploys`
- `3e6c47c` `Support anon IDs without crypto.randomUUID`
- `abbaaf4` `Disable unsyncable investor activity queries`
- `4dfe842` `Restore investor activity sync in production`
- `21a97f8` `Fix app image build target`

## Final Recommendation

Before wiping production, do one small round of infra hardening in this repo first:

1. make the ingress mode explicit
2. add a preflight script
3. align fresh-init and existing-volume bootstrap paths
4. add automated browser smoke after deploy

Those four changes would remove most of the guesswork that caused the first rollout to require live troubleshooting.
