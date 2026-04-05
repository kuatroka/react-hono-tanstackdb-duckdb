import { Hono } from "hono";
import { getDuckDBConnection } from "../duckdb";

const assetsRoutes = new Hono();

function sqlStringLiteral(value: string): string {
    return `'${value.replaceAll("'", "''")}'`;
}

/**
 * GET /api/assets?limit=<n>&offset=<n>
 *
 * Returns all assets from the DuckDB assets table.
 * Used by TanStack DB collection for eager loading.
 */
assetsRoutes.get("/", async (c) => {
    const limit = Math.min(parseInt(c.req.query("limit") || "50000", 10), 50000);
    const offset = parseInt(c.req.query("offset") || "0", 10);

    try {
        const conn = await getDuckDBConnection();

        const sql = `
      SELECT 
        asset,
        asset_name as "assetName",
        cusip
      FROM assets
      ORDER BY asset_name ASC
      LIMIT ${limit} OFFSET ${offset}
    `;

        const reader = await conn.runAndReadAll(sql);
        const rows = reader.getRows();

        const results = rows.map((row: unknown[], index: number) => ({
            id: `${row[0]}-${row[2] || index}`,
            asset: row[0] as string,
            assetName: row[1] as string,
            cusip: row[2] as string | null,
        }));

        // Query completed in: Math.round((performance.now() - startTime) * 100) / 100 ms

        return c.json(results);
    } catch (error) {
        console.error("[DuckDB Assets] Error:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return c.json({ error: "Assets query failed", details: errorMessage }, 500);
    }
});

/**
 * GET /api/assets/:code
 * GET /api/assets/:code/:cusip
 *
 * Returns a single asset record for detail pages without hydrating the full assets collection.
 */
assetsRoutes.get("/:code/:cusip?", async (c) => {
    const code = c.req.param("code");
    const cusip = c.req.param("cusip");

    try {
        const conn = await getDuckDBConnection();

        const reader = await conn.runAndRead(cusip
            ? `
      SELECT
        asset,
        asset_name as "assetName",
        cusip
      FROM assets
      WHERE asset = ${sqlStringLiteral(code)} AND cusip = ${sqlStringLiteral(cusip)}
      LIMIT 1
    `
            : `
      SELECT
        asset,
        asset_name as "assetName",
        cusip
      FROM assets
      WHERE asset = ${sqlStringLiteral(code)}
      ORDER BY asset_name ASC
      LIMIT 1
    `);
        await reader.readAll();
        const rows = reader.getRows();

        if (rows.length === 0) {
            return c.json({ error: "Asset not found" }, 404);
        }

        const row = rows[0];
        return c.json({
            id: `${row[0]}-${row[2] || "none"}`,
            asset: row[0] as string,
            assetName: row[1] as string,
            cusip: row[2] as string | null,
        });
    } catch (error) {
        console.error("[DuckDB Asset] Error:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return c.json({ error: "Asset query failed", details: errorMessage }, 500);
    }
});

export default assetsRoutes;
