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
RETAIN_IMAGES_HELPER="${RETAIN_IMAGES_HELPER:-$REPO_ROOT/infra/prod/scripts/retain-images.sh}"

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

compose_project_name_base="${COMPOSE_PROJECT_NAME:-fintellectus-tanstackdb}"
container_name_prefix="${APP_CONTAINER_NAME_PREFIX:-${APP_CONTAINER_NAME:-fintellectus_tanstackdb_app}}"
blue_port="${APP_BLUE_BIND_PORT:-${APP_BIND_PORT:-3200}}"
green_port="${APP_GREEN_BIND_PORT:-}"
if [[ -z "$green_port" ]]; then
  green_port="$((blue_port + 1))"
fi

if [[ "$blue_port" == "$green_port" ]]; then
  echo "APP_BLUE_BIND_PORT and APP_GREEN_BIND_PORT must be different." >&2
  exit 1
fi

slot_port() {
  case "$1" in
    blue) printf '%s\n' "$blue_port" ;;
    green) printf '%s\n' "$green_port" ;;
    *)
      echo "Unsupported deployment slot: $1" >&2
      exit 1
      ;;
  esac
}

opposite_slot() {
  case "$1" in
    blue) printf 'green\n' ;;
    green) printf 'blue\n' ;;
    *)
      echo "Unsupported deployment slot: $1" >&2
      exit 1
      ;;
  esac
}

compose_project_name_for_slot() {
  printf '%s\n' "${compose_project_name_base}-$1"
}

container_name_for_slot() {
  printf '%s\n' "${container_name_prefix}_$1"
}

compose_slot() {
  local slot="$1"
  shift

  COMPOSE_PROJECT_NAME="$(compose_project_name_for_slot "$slot")" \
  APP_CONTAINER_NAME="$(container_name_for_slot "$slot")" \
  APP_BIND_PORT="$(slot_port "$slot")" \
  APP_IMAGE="$APP_IMAGE" \
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

healthcheck_url_for_port() {
  local port="$1"
  local bind_host="${APP_BIND_HOST:-127.0.0.1}"
  local health_path="${APP_HEALTHCHECK_PATH:-/healthz}"
  printf 'http://%s:%s%s\n' "$bind_host" "$port" "$health_path"
}

active_slot="${ACTIVE_SLOT:-}"
if [[ "$active_slot" != "blue" && "$active_slot" != "green" ]]; then
  echo "Rollback requires ACTIVE_SLOT to be blue or green in $STATE_FILE." >&2
  exit 1
fi

rollback_image="${PREVIOUS_APP_IMAGE:-${PREVIOUS_CONTAINER_IMAGE:-${PREVIOUS_ALIAS_IMAGE:-}}}"
rollback_git_ref="${PREVIOUS_DEPLOY_GIT_REF:-${PREVIOUS_APP_RELEASE_ID:-}}"
if [[ -z "$rollback_image" ]]; then
  echo "No previous image available for rollback." >&2
  exit 1
fi

if ! docker image inspect "$rollback_image" >/dev/null 2>&1; then
  echo "Rollback image is not available locally: $rollback_image" >&2
  exit 1
fi

current_release_before_rollback="${APP_RELEASE_ID:-}"
current_git_sha_before_rollback="${APP_GIT_SHA:-}"
current_image_before_rollback="${APP_IMAGE:-}"
current_slot_before_rollback="$active_slot"
current_port_before_rollback="${ACTIVE_PORT:-$(slot_port "$active_slot")}"
current_container_before_rollback="${ACTIVE_CONTAINER_NAME:-$(container_name_for_slot "$active_slot")}"
current_deployed_at_before_rollback="${DEPLOYED_AT:-}"

target_slot="$(opposite_slot "$active_slot")"
target_port="$(slot_port "$target_slot")"

export APP_IMAGE="$rollback_image"
export APP_RELEASE_ID="${PREVIOUS_APP_RELEASE_ID:-rollback-$(date -u +%Y%m%dT%H%M%SZ)}"
export APP_GIT_SHA="${PREVIOUS_APP_GIT_SHA:-}"

cd "$REPO_ROOT"

compose_slot "$target_slot" config >/dev/null
compose_slot "$target_slot" up -d --no-build app
APP_HEALTHCHECK_URL="$(healthcheck_url_for_port "$target_port")" CHECK_PUBLIC_ENDPOINTS=0 bash "$SCRIPT_DIR/healthcheck.sh" "$ENV_FILE"
APP_PROXY_BIND_PORT="$target_port" RELOAD_CADDY=1 bash "$SCRIPT_DIR/render-caddyfile.sh" "$ENV_FILE"
APP_HEALTHCHECK_URL="$(healthcheck_url_for_port "$target_port")" CHECK_PUBLIC_ENDPOINTS="${CHECK_PUBLIC_ENDPOINTS_AFTER_SWITCH:-1}" bash "$SCRIPT_DIR/healthcheck.sh" "$ENV_FILE"

if [[ -n "$current_image_before_rollback" ]] && [[ "$current_image_before_rollback" != "$APP_IMAGE" ]]; then
  docker tag "$current_image_before_rollback" "$IMAGE_REPOSITORY:$PREVIOUS_ALIAS_TAG"
fi
docker tag "$APP_IMAGE" "$IMAGE_REPOSITORY:$CURRENT_ALIAS_TAG"

compose_slot "$active_slot" down --remove-orphans >/dev/null 2>&1 || true

mkdir -p "$(dirname "$STATE_FILE")"
cat > "$STATE_FILE" <<EOF
APP_RELEASE_ID=$APP_RELEASE_ID
APP_GIT_SHA=$APP_GIT_SHA
APP_IMAGE=$APP_IMAGE
DEPLOY_GIT_REF=$rollback_git_ref
DEPLOY_GIT_BRANCH=${PREVIOUS_DEPLOY_GIT_BRANCH:-}
DEPLOY_GIT_TAG=${PREVIOUS_DEPLOY_GIT_TAG:-}
ACTIVE_SLOT=$target_slot
ACTIVE_PORT=$target_port
ACTIVE_CONTAINER_NAME=$(container_name_for_slot "$target_slot")
CURRENT_ALIAS_IMAGE=$IMAGE_REPOSITORY:$CURRENT_ALIAS_TAG
PREVIOUS_ALIAS_IMAGE=$IMAGE_REPOSITORY:$PREVIOUS_ALIAS_TAG
PREVIOUS_CONTAINER_IMAGE=$current_image_before_rollback
PREVIOUS_APP_RELEASE_ID=$current_release_before_rollback
PREVIOUS_APP_GIT_SHA=$current_git_sha_before_rollback
PREVIOUS_APP_IMAGE=$current_image_before_rollback
PREVIOUS_ACTIVE_SLOT=$current_slot_before_rollback
PREVIOUS_ACTIVE_PORT=$current_port_before_rollback
PREVIOUS_ACTIVE_CONTAINER_NAME=$current_container_before_rollback
PREVIOUS_DEPLOYED_AT=$current_deployed_at_before_rollback
PREVIOUS_DEPLOY_GIT_REF=${DEPLOY_GIT_REF:-}
PREVIOUS_DEPLOY_GIT_BRANCH=${DEPLOY_GIT_BRANCH:-}
PREVIOUS_DEPLOY_GIT_TAG=${DEPLOY_GIT_TAG:-}
DEPLOYED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF

if [[ -x "$RETAIN_IMAGES_HELPER" ]]; then
  PIN_CURRENT_IMAGE="$APP_IMAGE" PIN_PREVIOUS_IMAGE="$current_image_before_rollback" "$RETAIN_IMAGES_HELPER" "$ENV_FILE" "$STATE_FILE"
fi

echo "Rollback completed successfully."
echo "Release: $APP_RELEASE_ID"
echo "Image: $APP_IMAGE"
echo "Deploy ref: ${rollback_git_ref:-<unknown>}"
echo "Active slot: $target_slot ($target_port)"
