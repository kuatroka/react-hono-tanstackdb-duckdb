export interface DuckDbRuntimeConfig {
  duckdbPath: string;
  threads: string;
  accessMode: "READ_ONLY";
  warmupTimeoutMs: number;
  queryTimeoutMs: number;
  drainTimeoutMs: number;
  refreshIntervalMs: number;
}

const DEFAULT_DUCKDB_PATH = "/Users/yo_macbook/Documents/app_data/TR_05_DB/TR_05_DUCKDB_FILE.duckdb";

export function getDuckDbRuntimeConfig(): DuckDbRuntimeConfig {
  return {
    duckdbPath: process.env.DUCKDB_PATH || DEFAULT_DUCKDB_PATH,
    threads: process.env.DUCKDB_THREADS || "4",
    accessMode: "READ_ONLY",
    warmupTimeoutMs: Number(process.env.DUCKDB_WARMUP_TIMEOUT_MS || 5_000),
    queryTimeoutMs: Number(process.env.DUCKDB_QUERY_TIMEOUT_MS || 30_000),
    drainTimeoutMs: Number(process.env.DUCKDB_DRAIN_TIMEOUT_MS || 30_000),
    refreshIntervalMs: Number(process.env.DUCKDB_REFRESH_INTERVAL_MS || 15_000),
  };
}

