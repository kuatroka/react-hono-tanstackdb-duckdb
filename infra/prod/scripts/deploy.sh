#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
ENV_FILE="${PROD_ENV_FILE:-$REPO_ROOT/infra/prod/.env.example}"
COMPOSE_FILE="${COMPOSE_FILE:-$REPO_ROOT/infra/prod/docker-compose.yml}"
STATE_FILE="${RELEASE_STATE_FILE:-$REPO_ROOT/infra/prod/.release-state.env}"
IMAGE_REPOSITORY="${APP_IMAGE_REPOSITORY:-fintellectus-tanstackdb-app}"
CURRENT_ALIAS_TAG="${APP_CURRENT_ALIAS_TAG:-prod-current}"
PREVIOUS_ALIAS_TAG="${APP_PREVIOUS_ALIAS_TAG:-prod-previous}"

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

set -a
. "$ENV_FILE"
set +a

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

source_sha=""
if [[ -d "$REPO_ROOT/.git" ]] && command -v git >/dev/null 2>&1; then
  source_sha="$(git -C "$REPO_ROOT" rev-parse --short=12 HEAD)"
fi

release_id="${APP_RELEASE_ID:-${source_sha:-$(date -u +%Y%m%dT%H%M%SZ)}}"
current_image="$IMAGE_REPOSITORY:$release_id"

previous_state_release_id=""
previous_state_git_sha=""
previous_state_image=""
previous_state_deployed_at=""
if [[ -f "$STATE_FILE" ]]; then
  set -a
  . "$STATE_FILE"
  set +a
  previous_state_release_id="${APP_RELEASE_ID:-}"
  previous_state_git_sha="${APP_GIT_SHA:-}"
  previous_state_image="${APP_IMAGE:-}"
  previous_state_deployed_at="${DEPLOYED_AT:-}"
fi

previous_container_image=""
if existing_container_id="$(compose ps -q app 2>/dev/null || true)"; [[ -n "$existing_container_id" ]]; then
  previous_container_image="$(docker inspect -f '{{.Config.Image}}' "$existing_container_id" 2>/dev/null || true)"
fi

export APP_RELEASE_ID="$release_id"
export APP_GIT_SHA="${source_sha:-}"
export APP_IMAGE="$current_image"

cd "$REPO_ROOT"

compose config >/dev/null
compose build app

if [[ -n "$previous_container_image" ]] && [[ "$previous_container_image" != "$APP_IMAGE" ]]; then
  docker tag "$previous_container_image" "$IMAGE_REPOSITORY:$PREVIOUS_ALIAS_TAG"
fi

docker tag "$APP_IMAGE" "$IMAGE_REPOSITORY:$CURRENT_ALIAS_TAG"

compose up -d --no-build app

bash "$SCRIPT_DIR/render-caddyfile.sh" "$ENV_FILE"
CHECK_PUBLIC_ENDPOINTS=0 bash "$SCRIPT_DIR/healthcheck.sh" "$ENV_FILE"

mkdir -p "$(dirname "$STATE_FILE")"
cat > "$STATE_FILE" <<EOF
APP_RELEASE_ID=$APP_RELEASE_ID
APP_GIT_SHA=$APP_GIT_SHA
APP_IMAGE=$APP_IMAGE
CURRENT_ALIAS_IMAGE=$IMAGE_REPOSITORY:$CURRENT_ALIAS_TAG
PREVIOUS_ALIAS_IMAGE=$IMAGE_REPOSITORY:$PREVIOUS_ALIAS_TAG
PREVIOUS_CONTAINER_IMAGE=$previous_container_image
PREVIOUS_APP_RELEASE_ID=$previous_state_release_id
PREVIOUS_APP_GIT_SHA=$previous_state_git_sha
PREVIOUS_APP_IMAGE=$previous_state_image
PREVIOUS_DEPLOYED_AT=$previous_state_deployed_at
DEPLOYED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF

echo "Production deployment completed successfully."
echo "Release: $APP_RELEASE_ID"
echo "Current image: $APP_IMAGE"
if [[ -n "$previous_container_image" ]]; then
  echo "Previous image: $previous_container_image"
fi
