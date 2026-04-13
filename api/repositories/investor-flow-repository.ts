import type { DuckDbConnection } from "@duckdb/node-api";
import { getDuckDbLease, type DuckDbLeaseContext } from "../db/lease-context";
import { runPreparedAndGetRows } from "../db/query-runner";

export async function getInvestorFlow(c: DuckDbLeaseContext, ticker: string) {
  const lease = getDuckDbLease(c);
  return lease.run("investorFlow.get", async (connection: DuckDbConnection) => {
    const stmt = await connection.prepare(`
      SELECT
        quarter,
        amt_inflow as inflow,
        amt_outflow as outflow
      FROM cusip_quarter_investor_flow
      WHERE ticker = ?
      ORDER BY quarter ASC
    `);
    stmt.bindVarchar(1, ticker);
    const rows = await runPreparedAndGetRows(stmt);

    return rows.map((row: unknown[]) => ({
      quarter: row[0] as string,
      inflow: Number(row[1]) || 0,
      outflow: Number(row[2]) || 0,
    }));
  });
}
