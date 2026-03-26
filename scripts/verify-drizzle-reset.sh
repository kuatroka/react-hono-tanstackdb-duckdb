#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT"

node scripts/verify-drizzle-schema.mjs

set -a
source .env
set +a

RUNTIME=$(./scripts/detect-container-runtime.sh)

cleanup() {
  $RUNTIME compose --env-file .env -f ./docker/docker-compose.yml down >/dev/null 2>&1 || true
}
trap cleanup EXIT

$RUNTIME compose --env-file .env -f ./docker/docker-compose.yml down -v >/dev/null 2>&1 || true
$RUNTIME compose --env-file .env -f ./docker/docker-compose.yml up -d zstart_postgres

for _ in {1..60}; do
  if psql "$ZERO_UPSTREAM_DB" -c 'select 1' >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

bun run db:migrate

if [[ -f scripts/db-seed.ts ]]; then
  bun run db:seed
fi

node scripts/verify-drizzle-schema.mjs
bash scripts/verify-app-ready.sh

echo "Drizzle reset/replay verification completed."
