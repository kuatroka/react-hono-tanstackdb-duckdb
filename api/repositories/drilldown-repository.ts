import type { DuckDbConnection } from "@duckdb/node-api";
import { getDuckDbLease, type DuckDbLeaseContext } from "../db/lease-context";
import { runAndGetRows } from "../db/query-runner";

function escapeSqlLiteral(value: string) {
  return value.replace(/'/g, "''");
}

function buildDrilldownQuery(ticker: string, quarter: string | null, action: string | null, limit: number) {
  const parquetPath = `/app_data/TR_BY_TICKER_CONSOLIDATED/cusip_ticker=${escapeSqlLiteral(ticker)}/*.parquet`;
  let whereClause = "1=1";

  if (quarter) {
    whereClause += ` AND r['quarter'] = '${escapeSqlLiteral(quarter)}'`;
  }

  if (action) {
    const actionMap: Record<string, string> = {
      open: "did_open",
      add: "did_add",
      reduce: "did_reduce",
      close: "did_close",
      hold: "did_hold",
    };
    const column = actionMap[action.toLowerCase()];
    if (column) {
      whereClause += ` AND r['${column}'] = true`;
    }
  }

  return `
    SELECT
      r['cusip']::TEXT as cusip,
      r['quarter']::TEXT as quarter,
      r['cik']::BIGINT as cik,
      r['did_open']::BOOLEAN as did_open,
      r['did_add']::BOOLEAN as did_add,
      r['did_reduce']::BOOLEAN as did_reduce,
      r['did_close']::BOOLEAN as did_close,
      r['did_hold']::BOOLEAN as did_hold,
      r['cusip_ticker']::TEXT as cusip_ticker
    FROM read_parquet('${parquetPath}') r
    WHERE ${whereClause}
    LIMIT ${limit}
  `;
}

function buildSummaryQuery(ticker: string, quarter: string | null) {
  const parquetPath = `/app_data/TR_BY_TICKER_CONSOLIDATED/cusip_ticker=${escapeSqlLiteral(ticker)}/*.parquet`;
  let whereClause = "1=1";

  if (quarter) {
    whereClause += ` AND r['quarter'] = '${escapeSqlLiteral(quarter)}'`;
  }

  return `
    SELECT
      r['quarter']::TEXT as quarter,
      COUNT(*) FILTER (WHERE r['did_open'] = true) as open_count,
      COUNT(*) FILTER (WHERE r['did_add'] = true) as add_count,
      COUNT(*) FILTER (WHERE r['did_reduce'] = true) as reduce_count,
      COUNT(*) FILTER (WHERE r['did_close'] = true) as close_count,
      COUNT(*) FILTER (WHERE r['did_hold'] = true) as hold_count,
      COUNT(*) as total_count
    FROM read_parquet('${parquetPath}') r
    WHERE ${whereClause}
    GROUP BY r['quarter']
    ORDER BY r['quarter'] DESC
  `;
}

export async function getDrilldown(c: DuckDbLeaseContext, params: { ticker: string; quarter: string | null; action: string | null; limit: number }) {
  const lease = getDuckDbLease(c);
  return lease.run("drilldown.get", async (connection: DuckDbConnection) => {
    const rows = await runAndGetRows(connection, buildDrilldownQuery(params.ticker, params.quarter, params.action, params.limit));
    return rows.map((row: unknown[]) => ({
      cusip: row[0] == null ? null : String(row[0]),
      quarter: row[1] == null ? null : String(row[1]),
      cik: row[2] == null ? null : String(row[2]),
      did_open: Boolean(row[3]),
      did_add: Boolean(row[4]),
      did_reduce: Boolean(row[5]),
      did_close: Boolean(row[6]),
      did_hold: Boolean(row[7]),
      cusip_ticker: row[8] == null ? null : String(row[8]),
    }));
  });
}

export async function getDrilldownSummary(c: DuckDbLeaseContext, params: { ticker: string; quarter: string | null }) {
  const lease = getDuckDbLease(c);
  return lease.run("drilldown.summary", async (connection: DuckDbConnection) => {
    const rows = await runAndGetRows(connection, buildSummaryQuery(params.ticker, params.quarter));
    return rows.map((row: unknown[]) => ({
      quarter: row[0] == null ? null : String(row[0]),
      open_count: Number(row[1]) || 0,
      add_count: Number(row[2]) || 0,
      reduce_count: Number(row[3]) || 0,
      close_count: Number(row[4]) || 0,
      hold_count: Number(row[5]) || 0,
      total_count: Number(row[6]) || 0,
    }));
  });
}
