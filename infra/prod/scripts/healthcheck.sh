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

bind_host="${APP_HEALTHCHECK_HOST:-${APP_BIND_HOST:-127.0.0.1}}"
bind_port="${APP_HEALTHCHECK_PORT:-${APP_BIND_PORT:-3000}}"
health_path="${APP_HEALTHCHECK_PATH:-/healthz}"
health_url="${APP_HEALTHCHECK_URL:-http://${bind_host}:${bind_port}${health_path}}"
public_health_url=""

if [[ "${CHECK_PUBLIC_ENDPOINTS:-0}" == "1" ]]; then
  public_health_base_url="${APP_PUBLIC_HEALTHCHECK_BASE_URL:-${APP_PUBLIC_URL:-}}"
  if [[ -n "$public_health_base_url" ]]; then
    public_health_url="${public_health_base_url%/}${health_path}"
  fi
fi

max_attempts="${HEALTHCHECK_MAX_ATTEMPTS:-30}"
interval_seconds="${HEALTHCHECK_INTERVAL_SECONDS:-1}"

for ((attempt = 1; attempt <= max_attempts; attempt += 1)); do
  if curl -fsS "$health_url" >/dev/null; then
    if [[ -z "$public_health_url" ]] || curl -fsS "$public_health_url" >/dev/null; then
      echo "Production health checks passed."
      exit 0
    fi
  fi
  sleep "$interval_seconds"
done

echo "Health check failed for $health_url" >&2
if [[ -n "$public_health_url" ]]; then
  echo "Public health check also failed for $public_health_url" >&2
fi
exit 1
