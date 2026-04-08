#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
ENV_FILE="${1:-${PROD_ENV_FILE:-$REPO_ROOT/infra/prod/.env.example}}"
TEMPLATE_PATH="${TEMPLATE_PATH:-$REPO_ROOT/infra/prod/Caddyfile.template}"
SITE_DIR="${CADDY_SITES_HOST_PATH:-$REPO_ROOT/infra/prod}"
SITE_BASENAME="${CADDY_SITE_BASENAME:-fintellectus-tanstackdb.Caddyfile}"
OUTPUT_PATH="${OUTPUT_PATH:-${CADDY_SITE_PATH:-$SITE_DIR/$SITE_BASENAME}}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

set -a
. "$ENV_FILE"
set +a

mkdir -p "$(dirname "$OUTPUT_PATH")"

sed \
  -e "s|__APP_DOMAIN__|${APP_DOMAIN}|g" \
  -e "s|__APP_BIND_PORT__|${APP_BIND_PORT}|g" \
  "$TEMPLATE_PATH" > "$OUTPUT_PATH"

echo "Rendered Caddy config to $OUTPUT_PATH"
