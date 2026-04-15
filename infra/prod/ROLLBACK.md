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

## Rollback principle

Rollback should reuse the previous known-good artifact rather than editing code on the server.

Preferred rollback path:

1. Stop the current app container
2. Re-run the deploy script with the previous release identifier or image
3. Re-point Caddy only if the public bind port changes

## What the deploy script keeps

The deploy process tracks:

- `APP_RELEASE_ID`
- `APP_GIT_SHA`
- `APP_IMAGE`
- `CURRENT_ALIAS_IMAGE`
- `PREVIOUS_ALIAS_IMAGE`
- `PREVIOUS_CONTAINER_IMAGE`

That gives a simple recovery path if the latest deploy needs to be reverted.

## Operator note

Do not `git pull` directly on the prod host as the deployment mechanism. Prod should consume a built artifact with a known release identity.
