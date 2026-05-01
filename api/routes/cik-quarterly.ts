import { Hono } from "hono";
import { getCikQuarterly } from "../repositories/cik-quarterly-repository";

const cikQuarterlyRoutes = new Hono();

export interface CikQuarterlyData {
    cik: string;
    quarter: string;
    quarterEndDate: string;
    totalValue: number;
    totalValuePrcChg: number | null;
    numAssets: number;
}

/**
 * GET /api/cik-quarterly/:cik
 *
 * Returns quarterly portfolio data for a specific CIK from every_cik_qtr table.
 * Used for the portfolio value line chart on superinvestor detail pages.
 */
cikQuarterlyRoutes.get("/:cik", async (c) => {
    const cik = c.req.param("cik");

    try {
        const rows = await getCikQuarterly(c, cik);

        return c.json({
            rows,
            count: rows.length,
            complete: true,
        });
    } catch (error) {
        console.error("[DuckDB CikQuarterly] Error:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return c.json({ error: "CIK quarterly query failed", details: errorMessage }, 500);
    }
});

export default cikQuarterlyRoutes;
