import type { DuckDbLease } from "./types";
import { DUCKDB_LEASE_CONTEXT_KEY } from "./hono-types";

export type DuckDbLeaseContext = {
  get: (key: typeof DUCKDB_LEASE_CONTEXT_KEY) => DuckDbLease | undefined;
};

export function getDuckDbLease(c: DuckDbLeaseContext) {
  const lease = c.get(DUCKDB_LEASE_CONTEXT_KEY);
  if (!lease) {
    throw new Error("DuckDB lease missing from request context");
  }

  return lease;
}
