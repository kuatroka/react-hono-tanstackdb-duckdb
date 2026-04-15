#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
ENV_FILE="${1:-${PROD_ENV_FILE:-$REPO_ROOT/infra/prod/.env.example}}"
WORKTREE_ROOT_DEFAULT="$REPO_ROOT/.deploy-worktrees"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

set -a
. "$ENV_FILE"
set +a

worktree_root="${APP_DEPLOY_WORKTREE_ROOT:-$WORKTREE_ROOT_DEFAULT}"
retention_days="${FAILED_WORKTREE_RETENTION_DAYS:-${APP_DEPLOY_FAILED_WORKTREE_RETENTION_DAYS:-7}}"
dry_run="${DRY_RUN:-0}"

if [[ ! -d "$worktree_root" ]]; then
  echo "No worktree root found at $worktree_root"
  exit 0
fi

if ! [[ "$retention_days" =~ ^[0-9]+$ ]]; then
  echo "FAILED_WORKTREE_RETENTION_DAYS must be a non-negative integer." >&2
  exit 1
fi

shopt -s nullglob
entries=("$worktree_root"/*)
shopt -u nullglob

if [[ ${#entries[@]} -eq 0 ]]; then
  echo "No failed worktrees found under $worktree_root"
  exit 0
fi

current_epoch="$(date +%s)"
pruned_count=0
kept_count=0

for path in "${entries[@]}"; do
  [[ -d "$path" ]] || continue

  mtime_epoch="$(stat -f %m "$path")"
  age_days="$(((current_epoch - mtime_epoch) / 86400))"

  if (( age_days < retention_days )); then
    kept_count=$((kept_count + 1))
    continue
  fi

  if [[ "$dry_run" == "1" ]]; then
    printf 'Would prune failed worktree: %s (age=%sd)\n' "$path" "$age_days"
    pruned_count=$((pruned_count + 1))
    continue
  fi

  git -C "$REPO_ROOT" worktree remove --force "$path" >/dev/null 2>&1 || rm -rf "$path"
  printf 'Pruned failed worktree: %s (age=%sd)\n' "$path" "$age_days"
  pruned_count=$((pruned_count + 1))
done

echo "Failed worktree prune complete. pruned=$pruned_count kept=$kept_count retention_days=$retention_days"
