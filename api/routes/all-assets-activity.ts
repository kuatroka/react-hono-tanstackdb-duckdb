import { Hono } from "hono";
import { getDuckDBConnection } from "../duckdb";

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
    const conn = await getDuckDBConnection();
    let rows: any[] = [];

    if (cusip || ticker) {
      // Query detailed activity for specific asset
      let whereClause = "";
      if (cusip) {
        whereClause = `cusip = '${cusip.replace(/'/g, "''")}'`;
      } else if (ticker) {
        whereClause = `ticker = '${ticker.replace(/'/g, "''")}'`;
      }

      const sql = `
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
         WHERE ${whereClause}
         ORDER BY quarter ASC
       `;

      const reader = await conn.runAndReadAll(sql);
      const rawRows = reader.getRows();

      rows = rawRows.map((row: any[], index: number) => ({
        id: index, // Synthetic ID
        quarter: row[0] as string,
        numOpen: Number(row[1]) || 0,
        numAdd: Number(row[2]) || 0,
        numReduce: Number(row[3]) || 0,
        numClose: Number(row[4]) || 0,
        numHold: Number(row[5]) || 0,
        cusip: row[6] as string,
        ticker: row[7] as string,
        // For chart compatibility
        opened: Number(row[1]) || 0,
        closed: Number(row[4]) || 0,
      }));

    } else {
      // Existing logic for ALL assets aggregated
      const sql = `
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
      `;

      const reader = await conn.runAndReadAll(sql);
      const rawRows = reader.getRows();

      rows = rawRows.map((row: any[]) => ({
        id: Number(row[0]),
        quarter: row[1] as string,
        totalOpen: Number(row[2]) || 0,
        totalAdd: Number(row[3]) || 0,
        totalReduce: Number(row[4]) || 0,
        totalClose: Number(row[5]) || 0,
        totalHold: Number(row[6]) || 0,
        // For chart compatibility (global)
        opened: Number(row[2]) || 0,
        closed: Number(row[5]) || 0,
      }));
    }

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
