import type { DuckDbConnection } from "@duckdb/node-api";
import { getDuckDbLease, type DuckDbLeaseContext } from "../db/lease-context";
import { runAndGetRows, runPreparedAndGetRows } from "../db/query-runner";

export async function getAllAssetsActivity(c: DuckDbLeaseContext, params: { cusip?: string | null; ticker?: string | null }) {
  const lease = getDuckDbLease(c);
  return lease.run("allAssetsActivity.get", async (connection: DuckDbConnection) => {
    if (params.cusip) {
      const stmt = await connection.prepare(`
         SELECT
           quarter,
           num_open,
           num_add,
           num_reduce,
           num_close,
           num_hold,
           cusip,
           ticker
         FROM cusip_quarter_investor_activity
         WHERE cusip = ?
         ORDER BY quarter ASC
      `);
      stmt.bindVarchar(1, params.cusip);
      const rows = await runPreparedAndGetRows(stmt);

      return rows.map((row: unknown[], index: number) => ({
        id: index,
        quarter: row[0] as string,
        numOpen: Number(row[1]) || 0,
        numAdd: Number(row[2]) || 0,
        numReduce: Number(row[3]) || 0,
        numClose: Number(row[4]) || 0,
        numHold: Number(row[5]) || 0,
        cusip: row[6] as string,
        ticker: row[7] as string,
        opened: Number(row[1]) || 0,
        closed: Number(row[4]) || 0,
      }));
    }

    if (params.ticker) {
      const stmt = await connection.prepare(`
         SELECT
           quarter,
           num_open,
           num_add,
           num_reduce,
           num_close,
           num_hold,
           cusip,
           ticker
         FROM cusip_quarter_investor_activity
         WHERE ticker = ?
         ORDER BY quarter ASC
      `);
      stmt.bindVarchar(1, params.ticker);
      const rows = await runPreparedAndGetRows(stmt);

      return rows.map((row: unknown[], index: number) => ({
        id: index,
        quarter: row[0] as string,
        numOpen: Number(row[1]) || 0,
        numAdd: Number(row[2]) || 0,
        numReduce: Number(row[3]) || 0,
        numClose: Number(row[4]) || 0,
        numHold: Number(row[5]) || 0,
        cusip: row[6] as string,
        ticker: row[7] as string,
        opened: Number(row[1]) || 0,
        closed: Number(row[4]) || 0,
      }));
    }

    const rows = await runAndGetRows(connection, `
      SELECT
        id,
        quarter,
        total_open,
        total_add,
        total_reduce,
        total_close,
        total_hold
      FROM all_assets_activity
      ORDER BY quarter ASC
    `);

    return rows.map((row: unknown[]) => ({
      id: Number(row[0]),
      quarter: row[1] as string,
      totalOpen: Number(row[2]) || 0,
      totalAdd: Number(row[3]) || 0,
      totalReduce: Number(row[4]) || 0,
      totalClose: Number(row[5]) || 0,
      totalHold: Number(row[6]) || 0,
      opened: Number(row[2]) || 0,
      closed: Number(row[5]) || 0,
    }));
  });
}
