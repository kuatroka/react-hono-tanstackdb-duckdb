import postgres from "postgres";

let sqlInstance: ReturnType<typeof postgres> | null = null;

function getConnectionString() {
  const connectionString = process.env.ZERO_UPSTREAM_DB;
  if (!connectionString) {
    throw new Error(
      "ZERO_UPSTREAM_DB environment variable is not set (upstream PostgreSQL is required only for /api/drilldown)"
    );
  }
  return connectionString;
}

/**
 * Lazily create the upstream PostgreSQL client.
 *
 * This avoids crashing server startup when the upstream DB isn't configured
 * (the UI primarily uses DuckDB-native routes).
 */
export function getUpstreamSql() {
  if (sqlInstance) return sqlInstance;
  sqlInstance = postgres(getConnectionString());
  return sqlInstance;
}
