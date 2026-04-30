# Deployment observability

Each production deployment records an annotated git tag, a GitHub Release, and a wiki history entry.
During deploy validation, CI records build and test durations in the job summary and uploads
JUnit/coverage artifacts.

## Where to check deploy impact

- GitHub Actions: `Deploy to Production`, `CI`, `Security Review`, and `DAST` workflow runs.
- GitHub Releases: latest `PROD-V-*` release for deployed commit and notes.
- Runtime endpoints: `/healthz`, `/__build`, and `/api/db-status`.
- Generated wiki: `Production-Deployments` for deploy chronology.

## Required manual check after risky deploys

1. Confirm `/healthz` includes the expected commit and deployment timestamp.
2. Confirm `/api/db-status` reports `ok: true` and active generation readiness.
3. Open assets, superinvestors, and one detail route with agent-browser when UI code changed.
