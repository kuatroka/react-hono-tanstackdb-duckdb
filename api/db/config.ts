export interface DuckDbRuntimeConfig {
  duckdbPath: string;
  threads: string;
  accessMode: "READ_ONLY";
  warmupTimeoutMs: number;
  queryTimeoutMs: number;
  drainTimeoutMs: number;
  refreshIntervalMs: number;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getDuckDbRuntimeConfig(): DuckDbRuntimeConfig {
  return {
    duckdbPath: requireEnv("DUCKDB_PATH"),
    threads: process.env.DUCKDB_THREADS || "4",
    accessMode: "READ_ONLY",
    warmupTimeoutMs: Number(process.env.DUCKDB_WARMUP_TIMEOUT_MS || 5_000),
    queryTimeoutMs: Number(process.env.DUCKDB_QUERY_TIMEOUT_MS || 30_000),
    drainTimeoutMs: Number(process.env.DUCKDB_DRAIN_TIMEOUT_MS || 30_000),
    refreshIntervalMs: Number(process.env.DUCKDB_REFRESH_INTERVAL_MS || 300_000),
  };
}

