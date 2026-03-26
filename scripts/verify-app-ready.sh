#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT"

set -a
source .env
set +a

ZERO_LOG=${ZERO_LOG:-/tmp/drizzle-zero.log}
API_LOG=${API_LOG:-/tmp/drizzle-api.log}
UI_LOG=${UI_LOG:-/tmp/drizzle-ui.log}
EXPORT_LOG=${EXPORT_LOG:-/tmp/drizzle-export.log}

rm -f "$ZERO_LOG" "$API_LOG" "$UI_LOG" "$EXPORT_LOG"
rm -rf "${ZERO_REPLICA_FILE}"*

cleanup() {
  jobs -pr | xargs -r kill >/dev/null 2>&1 || true
  jobs -pr | xargs -r wait >/dev/null 2>&1 || true
}
trap cleanup EXIT

bun run scripts/sec-app-export-smoke.ts >"$EXPORT_LOG" 2>&1

(bun run dev:zero-cache) >"$ZERO_LOG" 2>&1 &
ZERO_PID=$!
node scripts/verify-zero-ready.mjs "$ZERO_LOG" 900000

(bun run dev:api) >"$API_LOG" 2>&1 &
API_PID=$!
for _ in {1..60}; do
  code=$(curl -sS -o /dev/null -w "%{http_code}" "http://localhost:${API_PORT}/api/zero/get-queries" || true)
  if [[ "$code" != "000" ]]; then
    break
  fi
  sleep 1
done

(bun run dev:ui -- --host 127.0.0.1) >"$UI_LOG" 2>&1 &
UI_PID=$!
for _ in {1..60}; do
  code=$(curl -sS -o /dev/null -w "%{http_code}" "http://localhost:3001/assets" || true)
  if [[ "$code" != "000" ]]; then
    break
  fi
  sleep 1
done

SMOKE_LOG=/tmp/drizzle-startup-shell.log
rm -f "$SMOKE_LOG"
for _ in {1..36}; do
  if bun run test:startup-shell >"$SMOKE_LOG" 2>&1; then
    cat "$SMOKE_LOG"
    echo "verify-app-ready completed"
    exit 0
  fi
  sleep 10
 done

cat "$SMOKE_LOG"
echo "verify-app-ready failed after waiting for synced data"
exit 1
