import { Hono } from "hono";
import { listAssets, getAssetByCode } from "../repositories/assets-repository";
import { API_LIMITS, ERROR_MESSAGES, HTTP_STATUS_CODES } from "@/lib/constants";

const assetsRoutes = new Hono();

/**
 * GET /api/assets?limit=<n>&offset=<n>
 *
 * Returns all assets from the DuckDB assets table.
 * Used by TanStack DB collection for eager loading.
 */
assetsRoutes.get("/", async (c) => {
    const limit = Math.min(parseInt(c.req.query("limit") || String(API_LIMITS.MAX_ASSETS_LIMIT), 10), API_LIMITS.MAX_ASSETS_LIMIT);
    const offset = parseInt(c.req.query("offset") || "0", 10);

    try {
        const results = await listAssets(c, { limit, offset });
        return c.json(results);
    } catch (error) {
        console.error("[DuckDB Assets] Error:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return c.json({ error: ERROR_MESSAGES.ASSETS_QUERY_FAILED, details: errorMessage }, HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR);
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
        const asset = await getAssetByCode(c, { code, cusip: cusip || undefined });

        if (!asset) {
            return c.json({ error: "Asset not found" }, HTTP_STATUS_CODES.NOT_FOUND);
        }

        return c.json(asset);
    } catch (error) {
        console.error("[DuckDB Asset] Error:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return c.json({ error: ERROR_MESSAGES.ASSET_QUERY_FAILED, details: errorMessage }, HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR);
    }
});

export default assetsRoutes;
