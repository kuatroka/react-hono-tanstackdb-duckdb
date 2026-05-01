# Incident response runbook

## Triage

1. Check `/healthz` for build metadata and service liveness.
2. Check `/api/db-status` for active DuckDB generation, lease counts, query timeout settings, and
   metric summaries.
3. Compare the deployed tag in GitHub Releases with the latest `Production-Deployments` wiki entry.
4. If the latest deploy correlates with the incident, revert the offending commit or redeploy the
   previous production tag.

## DuckDB data freshness incidents

- Verify `DUCKDB_PATH` and the active manifest point at the expected database file.
- Use `/api/data-freshness` to confirm the frontend cache version matches the backend data version.
- If cache freshness is wrong, ask users to reload after the cache invalidation path has completed.

## Escalation

- P0: production unavailable, data responses corrupt, or `/healthz` fails.
- P1: major route degraded, search unusable, or stale data persists after reload.
- P2/P3: isolated UI regressions or non-critical telemetry gaps.
