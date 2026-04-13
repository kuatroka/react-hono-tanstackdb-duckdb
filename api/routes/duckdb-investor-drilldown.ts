import { Hono } from "hono";
import { getInvestorDrilldown } from "../repositories/investor-drilldown-repository";

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
    const rows = await getInvestorDrilldown(c, {
      ticker,
      cusip,
      quarter,
      action: actionRaw as "open" | "close" | "both",
      limit,
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
