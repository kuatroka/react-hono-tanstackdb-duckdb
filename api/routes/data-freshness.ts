import { Hono } from "hono";
import { duckDbGenerationManager } from "../db/generation-manager";
import { getDataFreshness } from "../repositories/data-freshness-repository";
import { getManifestVersion } from "../duckdb-manifest";

const dataFreshnessRoutes = new Hono();

dataFreshnessRoutes.get("/", async (c) => {
    try {
        const lastDataLoadDate = await getDataFreshness(c);
        const dbVersion = getManifestVersion();
        const status = await duckDbGenerationManager.getStatus();

        return c.json({
            lastDataLoadDate,
            dbVersion,
            servingGenerationId: status.activeGenerationId,
            servingManifestVersion: status.activeSnapshot?.manifestVersion ?? null,
            servingManifestActive: status.activeSnapshot?.manifestActive ?? null,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error("[DataFreshness] Error:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return c.json({ error: "Failed to check data freshness", details: errorMessage }, 500);
    }
});

export default dataFreshnessRoutes;
