import type { DuckDbConnection } from "@duckdb/node-api";
import { getDuckDbLease, type DuckDbLeaseContext } from "../db/lease-context";
import { runAndGetRows } from "../db/query-runner";

function escapeSqlLiteral(value: string) {
  return value.replace(/'/g, "''");
}

export async function getSuperinvestorAssetHistory(
  c: DuckDbLeaseContext,
  params: { ticker: string; cusip: string; cik: string },
) {
  const lease = getDuckDbLease(c);
  return lease.run("superinvestorAssetHistory.get", async (connection: DuckDbConnection) => {
    const cik = escapeSqlLiteral(params.cik);
    const ticker = escapeSqlLiteral(params.ticker);
    const cusip = escapeSqlLiteral(params.cusip);

    const rows = await runAndGetRows(connection, `
      SELECT
        quarter,
        report_window_complete,
        LOWER(COALESCE(
          source_tr_type_adj,
          CASE
            WHEN did_open THEN 'open'
            WHEN did_add THEN 'add'
            WHEN did_hold THEN 'hold'
            WHEN did_reduce THEN 'reduce'
            WHEN did_close THEN 'close'
            ELSE 'hold'
          END
        )) AS action,
        COALESCE(shares_current_adj, shares_current_raw, 0) AS shares_current_adj,
        COALESCE(amt_current, 0) AS position_value,
        source_tr_shares,
        source_tr_value,
        source_tr_duration_qtr
      FROM cusip_quarter_investor_activity_detail
      WHERE ticker = '${ticker}'
        AND cusip = '${cusip}'
        AND CAST(cik AS VARCHAR) = '${cik}'
        AND COALESCE(report_window_complete, false)
      ORDER BY quarter ASC
    `);

    return rows.map((row: unknown[]) => ({
      quarter: String(row[0] ?? ""),
      reportWindowComplete: Boolean(row[1]),
      action: String(row[2] ?? "hold"),
      sharesCurrentAdj: Number(row[3]) || 0,
      positionValue: Number(row[4]) || 0,
      transactionShares: row[5] == null ? null : Number(row[5]),
      transactionValue: row[6] == null ? null : Number(row[6]),
      holdingDurationQuarters: row[7] == null ? null : Number(row[7]),
    }));
  });
}
