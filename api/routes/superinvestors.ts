import { Hono } from "hono";
import { getDuckDBConnection } from "../duckdb";
import { API_LIMITS, ERROR_MESSAGES, HTTP_STATUS_CODES } from "@/lib/constants";

const superinvestorsRoutes = new Hono();
const MISSING_CIK_NAME_SENTINEL = "!!! no cik_name found !!!";

function normalizeSuperinvestorName(name: string | null | undefined, cik: string) {
    const trimmed = name?.trim();
    if (!trimmed || trimmed === MISSING_CIK_NAME_SENTINEL) {
        return `Unknown filer (${cik})`;
    }
    return trimmed;
}

/**
 * GET /api/superinvestors?limit=<n>&offset=<n>
 *
 * Returns all superinvestors from the DuckDB superinvestors table.
 * Used by TanStack DB collection for eager loading.
 */
superinvestorsRoutes.get("/", async (c) => {
    const limit = Math.min(parseInt(c.req.query("limit") || "20000", 10), 20000);
    const offset = parseInt(c.req.query("offset") || "0", 10);

    try {
        const conn = await getDuckDBConnection();

        const sql = `
      SELECT
        cik,
        cik_name as "cikName"
      FROM superinvestors
      ORDER BY cik_name ASC
      LIMIT ${limit} OFFSET ${offset}
    `;

        const reader = await conn.runAndReadAll(sql);
        const rows = reader.getRows();

        const results = rows.map((row: any[]) => {
            const cik = String(row[0]);
            return {
                id: cik,
                cik,
                cikName: normalizeSuperinvestorName(row[1] as string | null, cik),
            };
        });

        return c.json(results);
    } catch (error) {
        console.error("[DuckDB Superinvestors] Error:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return c.json({ error: ERROR_MESSAGES.ASSETS_QUERY_FAILED, details: errorMessage }, HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR);
    }
});

/**
 * GET /api/superinvestors/:cik
 *
 * Returns a single superinvestor by CIK.
 */
superinvestorsRoutes.get("/:cik", async (c) => {
    const cik = c.req.param("cik");

    try {
        const conn = await getDuckDBConnection();

        const sql = `
      SELECT 
        cik,
        cik_name as "cikName"
      FROM superinvestors
      WHERE cik = ?
      LIMIT 1
    `;

        const stmt = await conn.prepare(sql);
        stmt.bindVarchar(1, cik);
        const reader = await stmt.runAndReadAll();
        const rows = reader.getRows();

        if (rows.length === 0) {
            return c.json({ error: "Superinvestor not found" }, 404);
        }

        const row = rows[0];
        const cikValue = String(row[0]);
        const result = {
            id: cikValue,
            cik: cikValue,
            cikName: normalizeSuperinvestorName(row[1] as string | null, cikValue),
        };

        return c.json(result);
    } catch (error) {
        console.error("[DuckDB Superinvestor] Error:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return c.json({ error: "Superinvestor query failed", details: errorMessage }, 500);
    }
});

export default superinvestorsRoutes;
