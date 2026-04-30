import { Hono } from "hono";
import { listSuperinvestors, getSuperinvestorByCik } from "../repositories/superinvestors-repository";
import { ERROR_MESSAGES, HTTP_STATUS_CODES } from "@/lib/constants";

const superinvestorsRoutes = new Hono();

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
        const result = await listSuperinvestors(c, { limit, offset });
        return c.json({
            rows: result.rows,
            totalCount: result.totalCount,
            limitApplied: result.limitApplied,
            offset: result.offset,
            complete: result.complete,
            nextOffset: result.complete ? null : result.offset + result.rows.length,
        });
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
        const result = await getSuperinvestorByCik(c, cik);

        if (!result) {
            return c.json({ error: "Superinvestor not found" }, 404);
        }

        return c.json(result);
    } catch (error) {
        console.error("[DuckDB Superinvestor] Error:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return c.json({ error: "Superinvestor query failed", details: errorMessage }, 500);
    }
});

export default superinvestorsRoutes;
