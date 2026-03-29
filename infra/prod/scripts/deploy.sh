#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
ENV_FILE="${PROD_ENV_FILE:-$REPO_ROOT/infra/prod/.env.example}"
COMPOSE_FILE="${COMPOSE_FILE:-$REPO_ROOT/infra/prod/docker-compose.yml}"

required_commands=(git docker curl sudo)
for command in "${required_commands[@]}"; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Missing required command: $command" >&2
    exit 1
  fi
done

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing production env file: $ENV_FILE" >&2
  exit 1
fi

set -a
. "$ENV_FILE"
set +a

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

cd "$REPO_ROOT"

git fetch origin main
git checkout main
git pull --ff-only origin main

compose config >/dev/null
compose build app permissions
compose up -d postgres

bash "$SCRIPT_DIR/apply-postgres-bootstrap.sh" "$ENV_FILE"
bash "$SCRIPT_DIR/deploy-zero-permissions.sh" "$ENV_FILE"

compose up -d app zero-cache

OUTPUT_PATH="${CADDY_SITE_PATH}" bash "$SCRIPT_DIR/render-caddyfile.sh" "$ENV_FILE"
sudo systemctl reload caddy

CHECK_PUBLIC_ENDPOINTS=1 bash "$SCRIPT_DIR/healthcheck.sh" "$ENV_FILE"

echo "Production deployment completed successfully."
