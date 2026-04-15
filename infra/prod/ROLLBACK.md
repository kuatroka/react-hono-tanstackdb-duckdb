# Production rollback guide

This project uses a two-environment model:

- **dev**: local Bun runtime and local services
- **prod**: the VPS deployment under `infra/prod/`

There is no staging environment.

## Deployment identity

Every production deploy should be tied to a release identity:

- a Git commit SHA when available
- or an explicit release tag / artifact label

The deploy script writes the deployed release to:

- `infra/prod/.release-state.env`

## Current production model

Production now uses a **blue/green single-host deployment** model without a remote registry:

- build the new image locally on the VPS
- start the new app container on the inactive loopback port
- run health checks against that new container
- switch Caddy to the new port
- verify the public endpoint
- only then stop the old container

Default ports:

- blue: `127.0.0.1:3200`
- green: `127.0.0.1:3201`

This avoids the downtime window that happens when a single container is torn down before the replacement is ready.

## Rollback principle

Rollback reuses the previously running local image on the VPS.

Preferred rollback path:

1. start the previous image in the inactive slot
2. health check it directly
3. switch Caddy to that slot
4. verify the public endpoint
5. stop the failed slot

This works **without Docker Hub or any external image registry**, as long as the previous image still exists on the VPS.

## What the deploy state keeps

The deploy process tracks:

- `APP_RELEASE_ID`
- `APP_GIT_SHA`
- `APP_IMAGE`
- `ACTIVE_SLOT`
- `ACTIVE_PORT`
- `ACTIVE_CONTAINER_NAME`
- `CURRENT_ALIAS_IMAGE`
- `PREVIOUS_ALIAS_IMAGE`
- `PREVIOUS_CONTAINER_IMAGE`
- `PREVIOUS_APP_RELEASE_ID`
- `PREVIOUS_APP_GIT_SHA`
- `PREVIOUS_APP_IMAGE`
- `PREVIOUS_ACTIVE_SLOT`
- `PREVIOUS_ACTIVE_PORT`
- `PREVIOUS_ACTIVE_CONTAINER_NAME`

That gives a simple recovery path if the latest deploy needs to be reverted.

## Operator notes

- Do not rely on `git pull` alone as the production deploy mechanism.
- Build the release image on the VPS from a known Git revision or tag.
- Keep at least the current and previous images on disk.
- Do not run aggressive Docker image pruning that would delete the rollback image.
- Make sure Caddy can be reloaded non-interactively via `CADDY_RELOAD_COMMAND`.
