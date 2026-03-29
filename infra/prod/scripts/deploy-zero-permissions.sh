#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$REPO_ROOT/infra/prod/docker-compose.yml}"
ENV_FILE="${1:-${PROD_ENV_FILE:-$REPO_ROOT/infra/prod/.env.example}}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

compose build permissions
compose run --rm permissions
