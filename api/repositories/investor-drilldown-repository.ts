import type { DuckDbConnection } from "@duckdb/node-api";
import { getDuckDbLease, type DuckDbLeaseContext } from "../db/lease-context";
import { runPreparedAndGetRows } from "../db/query-runner";

export async function getInvestorDrilldown(
  c: DuckDbLeaseContext,
  params: { ticker: string; cusip: string | null; quarter: string | null; action: "open" | "close" | "both"; limit: number }
) {
  const lease = getDuckDbLease(c);
  return lease.run("investorDrilldown.get", async (connection: DuckDbConnection) => {
    const buildSelect = (actionCol: "did_open" | "did_close", actionLabel: "open" | "close") => `
      SELECT
        d.cusip,
        d.quarter,
        d.cik,
        d.did_open,
        d.did_add,
        d.did_reduce,
        d.did_close,
        d.did_hold,
        s.cik_name,
        s.cik_ticker,
        '${actionLabel}' as action_label
      FROM cusip_quarter_investor_activity_detail d
      LEFT JOIN superinvestors s ON s.cik = d.cik
      WHERE d.ticker = ?
        AND (? IS NULL OR d.cusip = ?)
        AND (? IS NULL OR d.quarter = ?)
        AND d.${actionCol} = true
      LIMIT ?
    `;

    const sql = params.action === "both"
      ? `(${buildSelect("did_open", "open")}) UNION ALL (${buildSelect("did_close", "close")})`
      : buildSelect(params.action === "open" ? "did_open" : "did_close", params.action);
    const stmt = await connection.prepare(sql);

    if (params.action === "both") {
      stmt.bindVarchar(1, params.ticker);
      if (params.cusip) {
        stmt.bindVarchar(2, params.cusip);
        stmt.bindVarchar(3, params.cusip);
      } else {
        stmt.bindNull(2);
        stmt.bindNull(3);
      }
      if (params.quarter) {
        stmt.bindVarchar(4, params.quarter);
        stmt.bindVarchar(5, params.quarter);
      } else {
        stmt.bindNull(4);
        stmt.bindNull(5);
      }
      stmt.bindInteger(6, params.limit);
      stmt.bindVarchar(7, params.ticker);
      if (params.cusip) {
        stmt.bindVarchar(8, params.cusip);
        stmt.bindVarchar(9, params.cusip);
      } else {
        stmt.bindNull(8);
        stmt.bindNull(9);
      }
      if (params.quarter) {
        stmt.bindVarchar(10, params.quarter);
        stmt.bindVarchar(11, params.quarter);
      } else {
        stmt.bindNull(10);
        stmt.bindNull(11);
      }
      stmt.bindInteger(12, params.limit);
    } else {
      stmt.bindVarchar(1, params.ticker);
      if (params.cusip) {
        stmt.bindVarchar(2, params.cusip);
        stmt.bindVarchar(3, params.cusip);
      } else {
        stmt.bindNull(2);
        stmt.bindNull(3);
      }
      if (params.quarter) {
        stmt.bindVarchar(4, params.quarter);
        stmt.bindVarchar(5, params.quarter);
      } else {
        stmt.bindNull(4);
        stmt.bindNull(5);
      }
      stmt.bindInteger(6, params.limit);
    }

    const rows = await runPreparedAndGetRows(stmt);
    return rows.map((row: unknown[], index: number) => {
      const rawCik = row[2];
      let cik: string | null;
      if (rawCik === null || rawCik === undefined) {
        cik = null;
      } else if (typeof rawCik === "bigint") {
        cik = rawCik.toString();
      } else {
        cik = String(rawCik);
      }

      return {
        id: index,
        cusip: row[0] as string | null,
        quarter: row[1] as string | null,
        cik,
        didOpen: row[3] as boolean | null,
        didAdd: row[4] as boolean | null,
        didReduce: row[5] as boolean | null,
        didClose: row[6] as boolean | null,
        didHold: row[7] as boolean | null,
        cikName: row[8] as string | null,
        cikTicker: row[9] as string | null,
        action: row[10] as "open" | "close",
      };
    });
  });
}
