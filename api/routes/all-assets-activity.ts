import { Hono } from "hono";
import { getAllAssetsActivity } from "../repositories/all-assets-activity-repository";

const allAssetsActivityRoutes = new Hono();

/**
 * GET /api/all-assets-activity
 *
 * Query params (optional):
 * - cusip: Filter by CUSIP
 * - ticker: Filter by Ticker
 *
 * If params provided:
 *   Returns investor activity for that specific asset from `cusip_quarter_investor_activity`.
 * 
 * If no params:
 *   Returns global aggregated activity from `all_assets_activity`.
 */
allAssetsActivityRoutes.get("/", async (c) => {
  const cusip = c.req.query("cusip");
  const ticker = c.req.query("ticker");

  try {
    const startTime = performance.now();
    const rows = await getAllAssetsActivity(c, { cusip, ticker });

    const queryTimeMs = Math.round((performance.now() - startTime) * 100) / 100;

    return c.json({
      rows,
      count: rows.length,
      queryTimeMs,
    });
  } catch (error) {
    console.error("[All Assets Activity] Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return c.json({ error: "Query failed", details: errorMessage }, 500);
  }
});

export default allAssetsActivityRoutes;
