import { Hono } from "hono";
import { getDrilldown, getDrilldownSummary } from "../repositories/drilldown-repository";
import { ERROR_MESSAGES, HTTP_STATUS_CODES } from "@/lib/constants";

const drilldownRoutes = new Hono();

/**
 * GET /api/drilldown/:ticker
 * 
 * Query investor activity drill-down data for a specific ticker.
 * Uses DuckDB native to read directly from partitioned Parquet files.
 * 
 * Query params:
 *   - quarter: Filter by quarter (e.g., "2024Q3")
 *   - action: Filter by action type ("open", "add", "reduce", "close", "hold")
 *   - limit: Max rows to return (default: 500)
 */
drilldownRoutes.get("/:ticker", async (c) => {
  const ticker = c.req.param("ticker").toUpperCase();
  const quarter = c.req.query("quarter") || null;
  const action = c.req.query("action") || null;
  const limit = parseInt(c.req.query("limit") || "500", 10);

  try {
    const result = await getDrilldown(c, { ticker, quarter, action, limit });

    return c.json({
      ticker,
      quarter,
      action,
      count: result.length,
      data: result,
    });
  } catch (error) {
    console.error("Drilldown query error:", error);

    // Check if it's a "file not found" type error (ticker doesn't exist)
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("No files found") || errorMessage.includes("does not exist")) {
      return c.json({
        error: `No data found for ticker: ${ticker}`,
        ticker,
      }, HTTP_STATUS_CODES.NOT_FOUND);
    }

    return c.json({
      error: ERROR_MESSAGES.DRILLDOWN_QUERY_FAILED,
      details: errorMessage,
    }, HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR);
  }
});

/**
 * GET /api/drilldown/:ticker/summary
 *
 * Get a summary of activity counts for a ticker, optionally filtered by quarter.
 */
drilldownRoutes.get("/:ticker/summary", async (c) => {
  const ticker = c.req.param("ticker").toUpperCase();
  const quarter = c.req.query("quarter") || null;

  try {
    const result = await getDrilldownSummary(c, { ticker, quarter });

    return c.json({
      ticker,
      quarter,
      summary: result,
    });
  } catch (error) {
    console.error("Drilldown summary error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes("No files found") || errorMessage.includes("does not exist")) {
      return c.json({
        error: `No data found for ticker: ${ticker}`,
        ticker,
      }, HTTP_STATUS_CODES.NOT_FOUND);
    }

    return c.json({
      error: ERROR_MESSAGES.DRILLDOWN_QUERY_FAILED,
      details: errorMessage,
    }, HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR);
  }
});

export default drilldownRoutes;
