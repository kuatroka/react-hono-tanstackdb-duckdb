import type { DuckDbConnection } from "@duckdb/node-api";
import { getDuckDbLease, type DuckDbLeaseContext } from "../db/lease-context";
import { runAndGetRows } from "../db/query-runner";

export async function getDataFreshness(c: DuckDbLeaseContext) {
  const lease = getDuckDbLease(c);
  return lease.run("dataFreshness.get", async (connection: DuckDbConnection) => {
    const rows = await runAndGetRows(connection, "SELECT last_data_load_date FROM high_level_totals LIMIT 1");
    return rows[0]?.[0] ? String(rows[0][0]) : null;
  });
}
