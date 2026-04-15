
import { Hono } from "hono";
import { getDuckDBConnection } from "../duckdb";

const investorFlowRoutes = new Hono();

investorFlowRoutes.get("/", async (c) => {
    const tickerRaw = (c.req.query("ticker") || "").trim();

    if (!tickerRaw) {
        return c.json({ error: "ticker is required" }, 400);
    }

    const ticker = tickerRaw.toUpperCase();

    try {
        const conn = await getDuckDBConnection();
        const escapedTicker = ticker.replace(/'/g, "''");

        // Query from cusip_quarter_investor_flow table
        const sql = `
      SELECT
        quarter,
        amt_inflow as inflow,
        amt_outflow as outflow
      FROM cusip_quarter_investor_flow
      WHERE ticker = '${escapedTicker}'
      ORDER BY quarter ASC
    `;

        const reader = await conn.runAndReadAll(sql);
        const rawRows = reader.getRows();

        // Map rows to objects
        const rows = rawRows.map((row: any[]) => ({
            quarter: row[0] as string,
            inflow: Number(row[1]) || 0,
            outflow: Number(row[2]) || 0,
        }));

        return c.json({
            ticker,
            count: rows.length,
            rows,
        });
    } catch (error) {
        console.error("[Investor Flow] Error:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return c.json({ error: "Query failed", details: errorMessage }, 500);
    }
});

export default investorFlowRoutes;
