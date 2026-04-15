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

proxy_bind_port="${APP_PROXY_BIND_PORT:-${APP_BIND_PORT}}"
if [[ -z "$proxy_bind_port" ]]; then
  echo "Missing APP_BIND_PORT / APP_PROXY_BIND_PORT." >&2
  exit 1
fi

mkdir -p "$(dirname "$OUTPUT_PATH")"

sed \
  -e "s|__APP_DOMAIN__|${APP_DOMAIN}|g" \
  -e "s|__APP_BIND_PORT__|${proxy_bind_port}|g" \
  "$TEMPLATE_PATH" > "$OUTPUT_PATH"

echo "Rendered Caddy config to $OUTPUT_PATH"

if [[ "${RELOAD_CADDY:-0}" != "1" ]]; then
  exit 0
fi

reload_command="${CADDY_RELOAD_COMMAND:-}"
if [[ -z "$reload_command" ]]; then
  if command -v systemctl >/dev/null 2>&1 && systemctl status caddy >/dev/null 2>&1; then
    reload_command="systemctl reload caddy"
  elif command -v service >/dev/null 2>&1 && service caddy status >/dev/null 2>&1; then
    reload_command="service caddy reload"
  fi
fi

if [[ -z "$reload_command" ]]; then
  echo "Unable to determine how to reload Caddy. Set CADDY_RELOAD_COMMAND in the prod env file." >&2
  exit 1
fi

bash -lc "$reload_command"
echo "Reloaded Caddy using: $reload_command"
