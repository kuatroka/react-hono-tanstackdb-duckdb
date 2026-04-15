import { Hono } from "hono";
import { getUpstreamSql } from "../db";

const drilldownRoutes = new Hono();

// Base path for parquet files (inside Docker container)
const PARQUET_BASE_PATH = "/app_data/TR_BY_TICKER_CONSOLIDATED";

/**
 * Build the parquet query with pg_duckdb syntax
 * Note: pg_duckdb requires r['column'] syntax for column access
 */
function buildDrilldownQuery(
  ticker: string,
  quarter: string | null,
  action: string | null,
  limit: number
): string {
  const parquetPath = `${PARQUET_BASE_PATH}/cusip_ticker=${ticker}/*.parquet`;
  
  let whereClause = "1=1";
  
  if (quarter) {
    whereClause += ` AND r['quarter'] = '${quarter}'`;
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

/**
 * GET /api/drilldown/:ticker
 * 
 * Query investor activity drill-down data for a specific ticker.
 * Uses pg_duckdb to read directly from partitioned Parquet files.
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
    const startTime = performance.now();

    // Build and execute raw SQL query with pg_duckdb
    const query = buildDrilldownQuery(ticker, quarter, action, limit);

    // Lazy-init upstream PostgreSQL client (only used by drilldown endpoints)
    const sql = getUpstreamSql();
    const result = await sql.unsafe(query);

    const queryTime = performance.now() - startTime;

    return c.json({
      ticker,
      quarter,
      action,
      count: result.length,
      queryTimeMs: Math.round(queryTime * 100) / 100,
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
      }, 404);
    }

    return c.json({ 
      error: "Failed to query drilldown data",
      details: errorMessage,
    }, 500);
  }
});

/**
 * Build summary query for a ticker
 */
function buildSummaryQuery(ticker: string, quarter: string | null): string {
  const parquetPath = `${PARQUET_BASE_PATH}/cusip_ticker=${ticker}/*.parquet`;
  
  let whereClause = "1=1";
  if (quarter) {
    whereClause += ` AND r['quarter'] = '${quarter}'`;
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

/**
 * GET /api/drilldown/:ticker/summary
 * 
 * Get a summary of activity counts for a ticker, optionally filtered by quarter.
 */
drilldownRoutes.get("/:ticker/summary", async (c) => {
  const ticker = c.req.param("ticker").toUpperCase();
  const quarter = c.req.query("quarter") || null;

  try {
    const startTime = performance.now();

    const query = buildSummaryQuery(ticker, quarter);

    // Lazy-init upstream PostgreSQL client
    const sql = getUpstreamSql();
    const result = await sql.unsafe(query);

    const queryTime = performance.now() - startTime;

    return c.json({
      ticker,
      quarter,
      queryTimeMs: Math.round(queryTime * 100) / 100,
      summary: result,
    });
  } catch (error) {
    console.error("Drilldown summary error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes("No files found") || errorMessage.includes("does not exist")) {
      return c.json({ 
        error: `No data found for ticker: ${ticker}`,
        ticker,
      }, 404);
    }

    return c.json({ 
      error: "Failed to query drilldown summary",
      details: errorMessage,
    }, 500);
  }
});

export default drilldownRoutes;
