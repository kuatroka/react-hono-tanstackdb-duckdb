#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
ENV_FILE="${1:-${PROD_ENV_FILE:-$REPO_ROOT/infra/prod/.env.example}}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

set -a
. "$ENV_FILE"
set +a

for attempt in {1..30}; do
  if curl -fsS "http://${APP_BIND_HOST}:${APP_BIND_PORT}/healthz" >/dev/null; then
    echo "Production health checks passed."
    exit 0
  fi
  sleep 1
done

echo "Health check failed for http://${APP_BIND_HOST}:${APP_BIND_PORT}/healthz" >&2
exit 1
