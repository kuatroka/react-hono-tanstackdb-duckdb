import { Hono } from "hono";
import { listAssets, getAssetByCode } from "../repositories/assets-repository";
import { API_LIMITS, ERROR_MESSAGES, HTTP_STATUS_CODES } from "@/lib/constants";

const assetsRoutes = new Hono();

/**
 * GET /api/assets?limit=<n>&offset=<n>&search=<query>&sort=asset|assetName|cusip&direction=asc|desc
 *
 * Returns paged asset rows from DuckDB for infinite virtualized loading.
 */
assetsRoutes.get("/", async (c) => {
    const limit = Math.min(parseInt(c.req.query("limit") || String(API_LIMITS.MAX_PAGE_SIZE), 10), API_LIMITS.MAX_ASSETS_LIMIT);
    const offset = parseInt(c.req.query("offset") || "0", 10);
    const search = c.req.query("search") || undefined;
    const sort = c.req.query("sort") as "asset" | "assetName" | "cusip" | undefined;
    const direction = c.req.query("direction") === "desc" ? "desc" : "asc";

    try {
        const result = await listAssets(c, { limit, offset, search, sort, direction });
        const nextOffset = result.complete ? null : offset + result.rows.length;
        return c.json({
            rows: result.rows,
            totalCount: result.totalCount,
            limitApplied: result.limitApplied,
            offset: result.offset,
            complete: result.complete,
            nextOffset,
            source: "api-duckdb",
        });
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
