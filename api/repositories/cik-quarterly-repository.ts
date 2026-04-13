import type { DuckDbConnection } from "@duckdb/node-api";
import { getDuckDbLease, type DuckDbLeaseContext } from "../db/lease-context";
import { runAndGetRows } from "../db/query-runner";

function escapeSqlLiteral(value: string) {
  return value.replace(/'/g, "''");
}

export async function getCikQuarterly(c: DuckDbLeaseContext, cik: string) {
  const lease = getDuckDbLease(c);
  return lease.run("cikQuarterly.get", async (connection: DuckDbConnection) => {
    const sql = `
      SELECT
        cik,
        quarter,
        quarter_end_date,
        ttl_value_per_cik_per_qtr,
        ttl_value_per_cik_per_qtr_prc_chg,
        num_assets_per_cik_per_qtr
      FROM every_cik_qtr
      WHERE cik = '${escapeSqlLiteral(cik)}'
      ORDER BY quarter_end_date ASC
    `;

    const rows = await runAndGetRows(connection, sql);
    return rows.map((row: unknown[]) => ({
      cik: row[0] == null ? "" : String(row[0]),
      quarter: row[1] == null ? "" : String(row[1]),
      quarterEndDate: row[2] == null ? "" : String(row[2]),
      totalValue: Number(row[3]) || 0,
      totalValuePrcChg: row[4] != null ? Number(row[4]) : null,
      numAssets: Number(row[5]) || 0,
    }));
  });
}
