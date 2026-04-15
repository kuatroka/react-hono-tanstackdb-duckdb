#!/usr/bin/env bash

set -euo pipefail

is_podman_usable() {
  command -v podman >/dev/null 2>&1 || return 1
  podman info >/dev/null 2>&1
}

is_docker_usable() {
  command -v docker >/dev/null 2>&1 || return 1
  docker info >/dev/null 2>&1
}

if is_podman_usable; then
  echo "podman"
  exit 0
fi

if is_docker_usable; then
  echo "docker"
  exit 0
fi

echo "Error: Neither podman nor docker is installed or functional." >&2
echo "Please install and start one of them:" >&2
echo "  - Podman: https://podman.io/getting-started/installation" >&2
echo "    (macOS: run 'podman machine init' and 'podman machine start')" >&2
echo "  - Docker: https://docs.docker.com/get-docker/" >&2
echo "    (Ensure Docker Desktop is running)" >&2
exit 1
