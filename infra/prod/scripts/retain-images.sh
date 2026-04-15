#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
ENV_FILE="${1:-${PROD_ENV_FILE:-$REPO_ROOT/infra/prod/.env.example}}"
STATE_FILE="${2:-${RELEASE_STATE_FILE:-$REPO_ROOT/infra/prod/.release-state.env}}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Missing required command: docker" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

set -a
. "$ENV_FILE"
if [[ -f "$STATE_FILE" ]]; then
  . "$STATE_FILE"
fi
set +a

container_name_prefix="${APP_CONTAINER_NAME_PREFIX:-${APP_CONTAINER_NAME:-fintellectus_tanstackdb_app}}"
pin_container_prefix="${APP_IMAGE_PIN_CONTAINER_PREFIX:-${container_name_prefix}_image_pin}"
current_pin_container="${pin_container_prefix}_current"
previous_pin_container="${pin_container_prefix}_previous"
current_image="${PIN_CURRENT_IMAGE:-${APP_IMAGE:-}}"
previous_image="${PIN_PREVIOUS_IMAGE:-${PREVIOUS_APP_IMAGE:-${PREVIOUS_CONTAINER_IMAGE:-}}}"

recreate_pin_container() {
  local container_name="$1"
  local image_ref="$2"
  local pin_role="$3"

  docker rm -f "$container_name" >/dev/null 2>&1 || true

  if [[ -z "$image_ref" ]]; then
    return 0
  fi

  if ! docker image inspect "$image_ref" >/dev/null 2>&1; then
    echo "Pin image is not available locally: $image_ref" >&2
    exit 1
  fi

  docker create \
    --name "$container_name" \
    --label "io.fintellectus.role=image-pin" \
    --label "io.fintellectus.pin_role=$pin_role" \
    "$image_ref" >/dev/null
}

recreate_pin_container "$current_pin_container" "$current_image" current
recreate_pin_container "$previous_pin_container" "$previous_image" previous

echo "Pinned current image: ${current_image:-<none>}"
echo "Pinned previous image: ${previous_image:-<none>}"
