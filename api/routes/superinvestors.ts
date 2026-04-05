import { Hono } from "hono";
import { getDuckDBConnection } from "../duckdb";

const superinvestorsRoutes = new Hono();

function sqlStringLiteral(value: string): string {
    return `'${value.replaceAll("'", "''")}'`;
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

        const results = rows.map((row: any[]) => ({
            id: String(row[0]),
            cik: String(row[0]),
            cikName: row[1] as string,
        }));

        // Query completed in: Math.round((performance.now() - startTime) * 100) / 100 ms

        return c.json(results);
    } catch (error) {
        console.error("[DuckDB Superinvestors] Error:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return c.json({ error: "Superinvestors query failed", details: errorMessage }, 500);
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

        const reader = await conn.runAndRead(`
      SELECT 
        cik,
        cik_name as "cikName"
      FROM superinvestors
      WHERE cik = ${sqlStringLiteral(cik)}
      LIMIT 1
    `);
        await reader.readAll();
        const rows = reader.getRows();

        if (rows.length === 0) {
            return c.json({ error: "Superinvestor not found" }, 404);
        }

        const row = rows[0];
        const result = {
            id: String(row[0]),
            cik: String(row[0]),
            cikName: row[1] as string,
        };

        return c.json(result);
    } catch (error) {
        console.error("[DuckDB Superinvestor] Error:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return c.json({ error: "Superinvestor query failed", details: errorMessage }, 500);
    }
});

export default superinvestorsRoutes;
