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
RELEASE_HELPER="${RELEASE_HELPER:-$REPO_ROOT/infra/prod/scripts/release.sh}"
RETAIN_IMAGES_HELPER="${RETAIN_IMAGES_HELPER:-$REPO_ROOT/infra/prod/scripts/retain-images.sh}"
PRUNE_FAILED_WORKTREES_HELPER="${PRUNE_FAILED_WORKTREES_HELPER:-$REPO_ROOT/infra/prod/scripts/prune-failed-worktrees.sh}"
WORKTREE_ROOT="${APP_DEPLOY_WORKTREE_ROOT:-$REPO_ROOT/.deploy-worktrees}"

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

explicit_release_id="${APP_RELEASE_ID:-}"
deploy_git_ref="${DEPLOY_GIT_REF:-}"
release_prefix="${APP_RELEASE_PREFIX:-prod}"
keep_failed_worktree="${KEEP_FAILED_WORKTREE:-${APP_DEPLOY_KEEP_FAILED_WORKTREE:-0}}"
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

compose_legacy() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

healthcheck_url_for_port() {
  local port="$1"
  local bind_host="${APP_BIND_HOST:-127.0.0.1}"
  local health_path="${APP_HEALTHCHECK_PATH:-/healthz}"
  printf 'http://%s:%s%s\n' "$bind_host" "$port" "$health_path"
}

source_sha=""
source_commit_sha=""
source_ref="${deploy_git_ref:-HEAD}"
source_branch=""
source_tag=""
worktree_path=""
worktree_cleanup_mode="remove"
deploy_succeeded="0"
cleanup_worktree() {
  local exit_code=$?
  if [[ -z "$worktree_path" || ! -d "$worktree_path" ]]; then
    exit "$exit_code"
  fi

  if [[ "$deploy_succeeded" == "1" ]]; then
    git -C "$REPO_ROOT" worktree remove --force "$worktree_path" >/dev/null 2>&1 || rm -rf "$worktree_path"
    exit "$exit_code"
  fi

  if [[ "$keep_failed_worktree" == "1" ]]; then
    worktree_cleanup_mode="preserved"
    printf 'Preserved failed deploy worktree at %s\n' "$worktree_path" >&2
    exit "$exit_code"
  fi

  git -C "$REPO_ROOT" worktree remove --force "$worktree_path" >/dev/null 2>&1 || rm -rf "$worktree_path"
  exit "$exit_code"
}
trap cleanup_worktree EXIT

has_git_repo="0"
if [[ -d "$REPO_ROOT/.git" ]]; then
  has_git_repo="1"
  if ! command -v git >/dev/null 2>&1; then
    echo "Missing required command: git" >&2
    exit 1
  fi

  if [[ -n "$deploy_git_ref" ]]; then
    git -C "$REPO_ROOT" fetch --all --tags --prune
    source_commit_sha="$(git -C "$REPO_ROOT" rev-parse --verify "${deploy_git_ref}^{commit}")"
    source_ref="$deploy_git_ref"
  else
    source_commit_sha="$(git -C "$REPO_ROOT" rev-parse HEAD)"
  fi

  source_sha="$(git -C "$REPO_ROOT" rev-parse --short=12 "$source_commit_sha")"
  source_branch="$(git -C "$REPO_ROOT" branch --contains "$source_commit_sha" --format='%(refname:short)' | grep -E '^[^ ]+$' | head -n 1 || true)"
  source_tag="$(git -C "$REPO_ROOT" describe --tags --exact-match "$source_commit_sha" 2>/dev/null || true)"
elif [[ -n "$deploy_git_ref" && "$deploy_git_ref" =~ ^[0-9a-f]{7,40}$ ]]; then
  # No .git directory present (common for VPS copies). If the deploy ref looks like a commit sha, use it as-is.
  source_commit_sha="$deploy_git_ref"
  source_sha="${deploy_git_ref:0:12}"
  source_ref="$deploy_git_ref"
fi

if [[ "$has_git_repo" == "1" && -z "$source_commit_sha" ]]; then
  echo "Unable to determine deployment commit SHA." >&2
  exit 1
fi

release_id="$explicit_release_id"
if [[ -z "$release_id" ]]; then
  if [[ "$has_git_repo" == "1" && -x "$RELEASE_HELPER" ]]; then
    release_id="$(APP_RELEASE_PREFIX="$release_prefix" DEPLOY_GIT_REF="$source_ref" "$RELEASE_HELPER" --git-ref "$source_ref")"
  elif [[ -n "$source_sha" ]]; then
    release_id="${release_prefix}-$(date -u +%Y%m%d)-${source_sha:0:7}"
  else
    release_id="${release_prefix}-$(date -u +%Y%m%dT%H%M%SZ)-nogit"
  fi
fi
current_image="$IMAGE_REPOSITORY:$release_id"

current_live_release_id=""
current_live_git_sha=""
current_live_image=""
current_live_slot=""
current_live_port=""
current_live_container_name=""
current_live_deployed_at=""
current_live_deploy_git_ref=""
current_live_deploy_git_branch=""
current_live_deploy_git_tag=""
if [[ -f "$STATE_FILE" ]]; then
  set -a
  . "$STATE_FILE"
  set +a
  current_live_release_id="${APP_RELEASE_ID:-}"
  current_live_git_sha="${APP_GIT_SHA:-}"
  current_live_image="${APP_IMAGE:-}"
  current_live_slot="${ACTIVE_SLOT:-}"
  current_live_port="${ACTIVE_PORT:-}"
  current_live_container_name="${ACTIVE_CONTAINER_NAME:-}"
  current_live_deployed_at="${DEPLOYED_AT:-}"
  current_live_deploy_git_ref="${DEPLOY_GIT_REF:-}"
  current_live_deploy_git_branch="${DEPLOY_GIT_BRANCH:-}"
  current_live_deploy_git_tag="${DEPLOY_GIT_TAG:-}"
fi

if [[ -z "$current_live_image" ]]; then
  if legacy_container_id="$(compose_legacy ps -q app 2>/dev/null || true)" && [[ -n "$legacy_container_id" ]]; then
    current_live_image="$(docker inspect -f '{{.Config.Image}}' "$legacy_container_id" 2>/dev/null || true)"
    current_live_slot="legacy"
    current_live_port="${APP_BIND_PORT:-$blue_port}"
    current_live_container_name="${APP_CONTAINER_NAME:-$container_name_prefix}"
  fi
fi

target_slot="blue"
if [[ "$current_live_slot" == "blue" || "$current_live_slot" == "green" ]]; then
  target_slot="$(opposite_slot "$current_live_slot")"
elif [[ "$current_live_slot" == "legacy" ]] && [[ "$current_live_port" == "$blue_port" ]]; then
  target_slot="green"
fi

target_port="$(slot_port "$target_slot")"

export APP_RELEASE_ID="$release_id"
export APP_GIT_SHA="${source_sha:-}"
export APP_IMAGE="$current_image"
export DEPLOY_GIT_REF="$source_ref"

if [[ "$has_git_repo" == "1" ]]; then
  mkdir -p "$WORKTREE_ROOT"
  worktree_path="$WORKTREE_ROOT/$release_id"
  rm -rf "$worktree_path"
  git -C "$REPO_ROOT" worktree add --force --detach "$worktree_path" "$source_commit_sha" >/dev/null

  export APP_BUILD_CONTEXT="$worktree_path"
  export APP_DOCKERFILE_PATH="$worktree_path/Dockerfile"
else
  worktree_path=""
  export APP_BUILD_CONTEXT="$REPO_ROOT"
  export APP_DOCKERFILE_PATH="$REPO_ROOT/Dockerfile"
fi

cd "$REPO_ROOT"

compose_slot "$target_slot" config >/dev/null
compose_slot "$target_slot" build app

if [[ -n "$current_live_image" ]] && [[ "$current_live_image" != "$APP_IMAGE" ]]; then
  docker tag "$current_live_image" "$IMAGE_REPOSITORY:$PREVIOUS_ALIAS_TAG"
fi
docker tag "$APP_IMAGE" "$IMAGE_REPOSITORY:$CURRENT_ALIAS_TAG"

compose_slot "$target_slot" up -d --no-build app
APP_HEALTHCHECK_URL="$(healthcheck_url_for_port "$target_port")" CHECK_PUBLIC_ENDPOINTS=0 bash "$SCRIPT_DIR/healthcheck.sh" "$ENV_FILE"
APP_PROXY_BIND_PORT="$target_port" RELOAD_CADDY=1 bash "$SCRIPT_DIR/render-caddyfile.sh" "$ENV_FILE"
APP_HEALTHCHECK_URL="$(healthcheck_url_for_port "$target_port")" CHECK_PUBLIC_ENDPOINTS="${CHECK_PUBLIC_ENDPOINTS_AFTER_SWITCH:-1}" bash "$SCRIPT_DIR/healthcheck.sh" "$ENV_FILE"

if [[ "$current_live_slot" == "blue" || "$current_live_slot" == "green" ]]; then
  compose_slot "$current_live_slot" down --remove-orphans >/dev/null 2>&1 || true
elif [[ "$current_live_slot" == "legacy" ]]; then
  compose_legacy down --remove-orphans >/dev/null 2>&1 || true
fi

mkdir -p "$(dirname "$STATE_FILE")"
cat > "$STATE_FILE" <<EOF
APP_RELEASE_ID=$APP_RELEASE_ID
APP_GIT_SHA=$APP_GIT_SHA
APP_IMAGE=$APP_IMAGE
DEPLOY_GIT_REF=$source_ref
DEPLOY_GIT_BRANCH=$source_branch
DEPLOY_GIT_TAG=$source_tag
ACTIVE_SLOT=$target_slot
ACTIVE_PORT=$target_port
ACTIVE_CONTAINER_NAME=$(container_name_for_slot "$target_slot")
CURRENT_ALIAS_IMAGE=$IMAGE_REPOSITORY:$CURRENT_ALIAS_TAG
PREVIOUS_ALIAS_IMAGE=$IMAGE_REPOSITORY:$PREVIOUS_ALIAS_TAG
PREVIOUS_CONTAINER_IMAGE=$current_live_image
PREVIOUS_APP_RELEASE_ID=$current_live_release_id
PREVIOUS_APP_GIT_SHA=$current_live_git_sha
PREVIOUS_APP_IMAGE=$current_live_image
PREVIOUS_ACTIVE_SLOT=$current_live_slot
PREVIOUS_ACTIVE_PORT=$current_live_port
PREVIOUS_ACTIVE_CONTAINER_NAME=$current_live_container_name
PREVIOUS_DEPLOY_GIT_REF=$current_live_deploy_git_ref
PREVIOUS_DEPLOY_GIT_BRANCH=$current_live_deploy_git_branch
PREVIOUS_DEPLOY_GIT_TAG=$current_live_deploy_git_tag
PREVIOUS_DEPLOYED_AT=$current_live_deployed_at
DEPLOYED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF

if [[ -x "$RETAIN_IMAGES_HELPER" ]]; then
  PIN_CURRENT_IMAGE="$APP_IMAGE" PIN_PREVIOUS_IMAGE="$current_live_image" "$RETAIN_IMAGES_HELPER" "$ENV_FILE" "$STATE_FILE"
fi

if [[ -x "$PRUNE_FAILED_WORKTREES_HELPER" ]]; then
  "$PRUNE_FAILED_WORKTREES_HELPER" "$ENV_FILE"
fi

deploy_succeeded="1"

echo "Production deployment completed successfully."
echo "Release: $APP_RELEASE_ID"
echo "Current image: $APP_IMAGE"
echo "Deploy ref: $source_ref"
echo "Active slot: $target_slot ($target_port)"
if [[ -n "$current_live_image" ]]; then
  echo "Previous image: $current_live_image"
fi
