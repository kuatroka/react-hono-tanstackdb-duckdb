#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
ENV_FILE="${PROD_ENV_FILE:-$REPO_ROOT/infra/prod/.env.example}"
COMPOSE_FILE="${COMPOSE_FILE:-$REPO_ROOT/infra/prod/docker-compose.yml}"
STATE_FILE="${RELEASE_STATE_FILE:-$REPO_ROOT/infra/prod/.release-state.env}"
IMAGE_REPOSITORY="${APP_IMAGE_REPOSITORY:-fintellectus-tanstackdb-app}"
ROLLBACK_TAG="${APP_ROLLBACK_TAG:-prod-previous}"

required_commands=(docker curl)
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

if [[ ! -f "$STATE_FILE" ]]; then
  echo "Missing release state file: $STATE_FILE" >&2
  exit 1
fi

set -a
. "$ENV_FILE"
. "$STATE_FILE"
set +a

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

rollback_image="${PREVIOUS_CONTAINER_IMAGE:-${PREVIOUS_APP_IMAGE:-}}"
if [[ -z "$rollback_image" ]]; then
  rollback_image="${PREVIOUS_ALIAS_IMAGE:-}"
fi

if [[ -z "$rollback_image" ]]; then
  echo "No previous image available for rollback." >&2
  exit 1
fi

current_image_before_rollback="${APP_IMAGE:-}"

cd "$REPO_ROOT"

export APP_IMAGE="$rollback_image"
export APP_RELEASE_ID="${PREVIOUS_APP_RELEASE_ID:-rollback}"
export APP_GIT_SHA="${PREVIOUS_APP_GIT_SHA:-}"

compose up -d --no-build app
bash "$SCRIPT_DIR/render-caddyfile.sh" "$ENV_FILE"
CHECK_PUBLIC_ENDPOINTS=0 bash "$SCRIPT_DIR/healthcheck.sh" "$ENV_FILE"

mkdir -p "$(dirname "$STATE_FILE")"
cat > "$STATE_FILE" <<EOF
APP_RELEASE_ID=$APP_RELEASE_ID
APP_GIT_SHA=$APP_GIT_SHA
APP_IMAGE=$APP_IMAGE
CURRENT_ALIAS_IMAGE=$IMAGE_REPOSITORY:$ROLLBACK_TAG
PREVIOUS_ALIAS_IMAGE=$IMAGE_REPOSITORY:$ROLLBACK_TAG
PREVIOUS_CONTAINER_IMAGE=$current_image_before_rollback
DEPLOYED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF

echo "Rollback completed successfully."
echo "Rolled back to: $APP_IMAGE"
