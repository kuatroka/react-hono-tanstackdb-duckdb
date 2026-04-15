import { Hono } from "hono";
import { getDuckDBConnection } from "../duckdb";
import { getManifestVersion } from "../duckdb-manifest";

const dataFreshnessRoutes = new Hono();

dataFreshnessRoutes.get("/", async (c) => {
    try {
        const conn = await getDuckDBConnection();
        const sql = `SELECT last_data_load_date FROM high_level_totals LIMIT 1`;
        const reader = await conn.runAndReadAll(sql);
        const rows = reader.getRows();

        const lastDataLoadDate = rows[0]?.[0]
            ? String(rows[0][0])
            : null;

        // Include manifest version for blue-green awareness
        const dbVersion = getManifestVersion();

        return c.json({
            lastDataLoadDate,
            dbVersion,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error("[DataFreshness] Error:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return c.json({ error: "Failed to check data freshness", details: errorMessage }, 500);
    }
});

export default dataFreshnessRoutes;
