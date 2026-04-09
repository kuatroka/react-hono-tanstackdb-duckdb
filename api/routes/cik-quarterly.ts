import { Hono } from "hono";
import { getDuckDBConnection } from "../duckdb";

const cikQuarterlyRoutes = new Hono();

export interface CikQuarterlyData {
    cik: string;
    quarter: string;
    quarterEndDate: string;
    totalValue: number;
    totalValuePrcChg: number | null;
    numAssets: number;
}

function escapeSqlLiteral(value: string) {
    return value.replace(/'/g, "''");
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
        const conn = await getDuckDBConnection();

        const sql = `
            SELECT
                cik,
                quarter,
                quarter_end_date,
                ttl_value_per_cik_per_qtr,
                ttl_value_per_cik_per_qtr_prc_chg,
                num_assets_per_cik_per_qtr
            FROM every_cik_qtr
            WHERE cik = '${escapeSqlLiteral(cik)}'
            ORDER BY quarter_end_date ASC
        `;

        const reader = await conn.runAndReadAll(sql);
        const rows = reader.getRows();

        const results: CikQuarterlyData[] = rows.map((row: unknown[]) => ({
            cik: row[0] == null ? "" : String(row[0]),
            quarter: row[1] == null ? "" : String(row[1]),
            quarterEndDate: row[2] == null ? "" : String(row[2]),
            totalValue: Number(row[3]) || 0,
            totalValuePrcChg: row[4] != null ? Number(row[4]) : null,
            numAssets: Number(row[5]) || 0,
        }));

        return c.json(results);
    } catch (error) {
        console.error("[DuckDB CikQuarterly] Error:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return c.json({ error: "CIK quarterly query failed", details: errorMessage }, 500);
    }
});

export default cikQuarterlyRoutes;
