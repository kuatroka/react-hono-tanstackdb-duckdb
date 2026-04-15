import { Hono } from "hono";
import { getDuckDBConnection } from "../duckdb";

const duckdbInvestorDrilldownRoutes = new Hono();

/**
 * GET /api/duckdb-investor-drilldown?ticker=&cusip=&quarter=&action=open|close&limit=
 * Extras:
 * - quarter=all returns all quarters
 * - action=both returns both open and close in one response
 * - cusip is optional; if provided, filters to that specific CUSIP
 *
 * Returns superinvestor-level rows for a given ticker, quarter, and action
 * using DuckDB native via @duckdb/node-api.
 */
duckdbInvestorDrilldownRoutes.get("/", async (c) => {
  const tickerRaw = (c.req.query("ticker") || "").trim();
  const cusipRaw = (c.req.query("cusip") || "").trim();
  const quarterRaw = (c.req.query("quarter") || "").trim() || "all";
  const actionRaw = (c.req.query("action") || "").trim().toLowerCase() || "both";
  const limit = Math.min(parseInt(c.req.query("limit") || "500", 10), 5000);

  if (!tickerRaw) {
    return c.json({ error: "ticker is required" }, 400);
  }

  if (!["open", "close", "both"].includes(actionRaw)) {
    return c.json({ error: "action must be 'open', 'close', or 'both'" }, 400);
  }

  const ticker = tickerRaw.toUpperCase();
  const cusip = cusipRaw || null;
  const quarter = quarterRaw === "all" ? null : quarterRaw;

  try {
    const startTime = performance.now();
    const conn = await getDuckDBConnection();

    const escapedTicker = ticker.replace(/'/g, "''");
    const escapedCusipClause = cusip ? `AND d.cusip = '${cusip.replace(/'/g, "''")}'` : "";
    const escapedQuarterClause = quarter ? `AND d.quarter = '${quarter.replace(/'/g, "''")}'` : "";

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
      WHERE d.ticker = '${escapedTicker}'
        ${escapedCusipClause}
        ${escapedQuarterClause}
        AND d.${actionCol} = true
      LIMIT ${limit}
    `;

    let sql: string;
    if (actionRaw === "both") {
      sql = `
        (${buildSelect("did_open", "open")})
        UNION ALL
        (${buildSelect("did_close", "close")})
      `;
    } else {
      const col = actionRaw === "open" ? "did_open" : "did_close";
      sql = buildSelect(col as "did_open" | "did_close", actionRaw as "open" | "close");
    }

    const reader = await conn.runAndReadAll(sql);
    const rawRows = reader.getRows();

    const rows = rawRows.map((row: any[], index: number) => {
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

    const queryTimeMs = Math.round((performance.now() - startTime) * 100) / 100;

    return c.json({
      ticker,
      quarter,
      action: actionRaw,
      count: rows.length,
      queryTimeMs,
      rows,
    });
  } catch (error) {
    console.error("[DuckDB Investor Drilldown] Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return c.json({ error: "Drilldown query failed", details: errorMessage }, 500);
  }
});

export default duckdbInvestorDrilldownRoutes;
