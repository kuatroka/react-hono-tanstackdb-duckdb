# Production deployment tracking

This repository tracks production promotions automatically through:

- the `Deploy to Production` GitHub Actions workflow
- an annotated `prod-*` git tag for every successful production deployment
- a GitHub Release for each production tag
- a GitHub wiki page named `Production-Deployments`

## Required GitHub environment

Create a protected environment named `prod`.

The following deployment values should be stored as `prod` environment secrets:

- `PROD_HOST`
- `PROD_USER`
- `PROD_SSH_KEY`
- `PROD_PORT` (optional, defaults to `22`)
- `PROD_DEPLOY_DIR` (optional, defaults to `/opt/dev/erudio_app/react-hono-tanstackdb-duckdb`)

Optional `prod` environment variable:

- `PROD_APP_URL`

## Bootstrap the GitHub environment from local env values

If you already have the deploy values in your local shell, you can create/update the `prod`
GitHub environment secrets automatically:

```bash
export PROD_HOST=your-server
export PROD_USER=deploy
export PROD_SSH_KEY="$(cat ~/.ssh/your-prod-key)"
export PROD_PORT=22
export PROD_DEPLOY_DIR=/opt/dev/erudio_app/react-hono-tanstackdb-duckdb
export PROD_APP_URL=https://your-domain.example.com

bun run prod:github:setup
```

Preview what would be sent without changing GitHub:

```bash
bun run prod:github:setup:dry-run
```

## Local history

To inspect the full production deployment history locally:

```bash
bun run prod:history
bun run prod:history:json
```

You can also write the markdown history to a file:

```bash
bun run prod:history -- --output /tmp/prod-history.md
```

## What gets recorded

Each successful production deploy creates:

- an annotated tag containing the deployment timestamp
- a GitHub Release for the deployed commit
- a refreshed wiki page with the full deployment table
