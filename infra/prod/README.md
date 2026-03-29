# Production Stack

This directory makes this repo the deployment source of truth for:

- the shared `pg_mooncake` Postgres container
- the Bun/Hono app container
- the single-node `zero-cache` container
- the Caddy reverse proxy config rendered on the VPS
- the GitHub Actions SSH deploy path

## Files

- `docker-compose.yml` defines the shared production stack.
- `.env.example` is the contract for the external env file stored on the VPS.
- `scripts/deploy.sh` performs a non-destructive deploy.
- `scripts/apply-postgres-bootstrap.sh` reapplies the idempotent SQL needed for an existing shared volume.
- `scripts/deploy-zero-permissions.sh` deploys Zero permissions with a Node 24 runner.
- `scripts/healthcheck.sh` verifies app, Zero, and Postgres readiness.
- `scripts/inspect-current-postgres.sh` captures the current prod container, ports, volume mounts, and DB settings before cutover.
- `sql/verify-zero-readiness.sql` fails fast if the shared DB is not ready for Zero.

## Expected VPS Layout

- Repo checkout: `/opt/dev/erudio_app/react-hono-zero-pg-main`
- External env file: `/etc/fintellectus/react-hono-zero-pg-main.env`
- Shared app data mount: `/opt/dev/erudio_app/app_data`
- Caddy site file: `/etc/caddy/sites/fintellectus.Caddyfile`

## First Cutover

1. Copy `infra/prod/.env.example` to the VPS env file path and replace all placeholder values.
2. Run `bash infra/prod/scripts/inspect-current-postgres.sh /etc/fintellectus/react-hono-zero-pg-main.env`.
3. Confirm the running Postgres container uses the expected `pg_mooncake` image lineage and the existing volume you want to keep.
4. Stop the old Postgres owner only during the coordinated cutover window.
5. Run `bash infra/prod/scripts/deploy.sh` from the repo checkout on the VPS.

The deploy script never calls `docker compose down -v` and never drops the shared Postgres volume.

## Caddy

`Caddyfile.template` renders two public sites:

- `APP_DOMAIN` -> Bun/Hono app on localhost `APP_BIND_PORT`
- `ZERO_DOMAIN` -> `zero-cache` on localhost `ZERO_BIND_PORT`

Caddy handles TLS, HTTP/2, HTTP/3, and WebSocket proxying for Zero.

The deploy path now also builds and runs a one-shot `permissions` container based on `node:24`, so `zero-deploy-permissions` can run with a supported runtime even though the app itself ships on Bun.

If you do not have real DNS yet, set `ZERO_PATH_PREFIX=/zero` and point `ZERO_PUBLIC_URL` at the same public app origin, for example `http://<vps-ip>/zero`.

- In this mode, Caddy keeps a single public app site and proxies `/zero/*` to `zero-cache`.
- This is the recommended temporary fallback for IP-only access because it avoids depending on an extra public port that may be blocked upstream.
- Once real DNS exists, unset `ZERO_PATH_PREFIX` and return to separate `APP_DOMAIN` / `ZERO_DOMAIN` hostnames.

## Next Stage: Dokploy Evaluation

After the first stable production deployment, the next platform layer to evaluate is `Dokploy`.

- Keep this repo's Docker Compose and deploy scripts as the source of truth.
- Treat Dokploy as an optional operator/control-plane layer for builds, restarts, logs, and visibility.
- Do not hand ingress ownership to Dokploy.
- Keep `Caddy` as the only reverse proxy and TLS terminator for public traffic.
- If Dokploy is introduced later, use it to manage the app stack behind localhost-bound ports, while `Caddy` continues routing `APP_DOMAIN` and `ZERO_DOMAIN`.

This avoids mixing Traefik-style platform ingress with the current Caddy setup and keeps the Zero WebSocket routing under one reverse-proxy owner.

## Zero Notes

- This stack is deliberately single-node: one `zero-cache`, no fan-out.
- `ZERO_UPSTREAM_DB` should be a direct connection to `postgres`.
- `ZERO_QUERY_URL` must stay on the public app hostname for Zero 1.x.
- This repo still uses legacy CRUD mutators, so `ZERO_MUTATE_URL` stays unset until the app migrates to custom mutators.
