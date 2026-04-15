#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

git_ref="${DEPLOY_GIT_REF:-HEAD}"
output_format="id"
create_tag="${CREATE_GIT_TAG:-0}"
release_prefix="${APP_RELEASE_PREFIX:-prod}"
release_date_override="${RELEASE_DATE_OVERRIDE:-}"
tag_message="${TAG_MESSAGE:-}"

usage() {
  cat <<'EOF'
Usage: release.sh [--git-ref <ref>] [--format <id|sha|env>] [--create-tag]

Examples:
  ./infra/prod/scripts/release.sh
  ./infra/prod/scripts/release.sh --git-ref prod-20260415-c2ff698 --format env
  ./infra/prod/scripts/release.sh --create-tag
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --git-ref)
      git_ref="$2"
      shift 2
      ;;
    --format)
      output_format="$2"
      shift 2
      ;;
    --create-tag)
      create_tag="1"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if ! command -v git >/dev/null 2>&1; then
  echo "Missing required command: git" >&2
  exit 1
fi

if [[ ! -d "$REPO_ROOT/.git" ]]; then
  echo "release.sh requires a git checkout at $REPO_ROOT" >&2
  exit 1
fi

resolved_sha="$(git -C "$REPO_ROOT" rev-parse --verify "${git_ref}^{commit}")"
short_sha="$(git -C "$REPO_ROOT" rev-parse --short=12 "$resolved_sha")"
release_date="${release_date_override:-$(date -u +%Y%m%d)}"
release_id="${APP_RELEASE_ID:-${release_prefix}-${release_date}-${short_sha:0:7}}"
resolved_ref="$(git -C "$REPO_ROOT" rev-parse --symbolic-full-name "$git_ref" 2>/dev/null || true)"
if [[ -z "$resolved_ref" || "$resolved_ref" == "$resolved_sha" ]]; then
  resolved_ref="$git_ref"
fi

if [[ "$create_tag" == "1" ]]; then
  if git -C "$REPO_ROOT" rev-parse --verify "refs/tags/$release_id" >/dev/null 2>&1; then
    echo "Git tag already exists: $release_id" >&2
    exit 1
  fi
  git -C "$REPO_ROOT" tag -a "$release_id" "$resolved_sha" -m "${tag_message:-$release_id}"
fi

case "$output_format" in
  id)
    printf '%s\n' "$release_id"
    ;;
  sha)
    printf '%s\n' "$short_sha"
    ;;
  env)
    printf 'APP_RELEASE_ID=%s\n' "$release_id"
    printf 'APP_GIT_SHA=%s\n' "$short_sha"
    printf 'DEPLOY_GIT_REF=%s\n' "$resolved_ref"
    ;;
  *)
    echo "Unsupported format: $output_format" >&2
    exit 1
    ;;
esac
