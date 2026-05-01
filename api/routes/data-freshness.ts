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

        const servingManifestVersion = status.activeSnapshot?.manifestVersion ?? null;
        const servingManifestActive = status.activeSnapshot?.manifestActive ?? null;
        const servingFileMtimeMs = status.activeSnapshot?.fileMtimeMs ?? null;
        const appVariant = process.env.APP_VARIANT?.trim() || "current";
        const dataVersion = [
            appVariant,
            servingManifestVersion ?? 'nomv',
            servingManifestActive ?? 'noactive',
            servingFileMtimeMs ?? 'nomtime',
            lastDataLoadDate ?? 'noload',
        ].join(':');

        return c.json({
            lastDataLoadDate,
            dbVersion,
            dataVersion,
            appVariant,
            servingGenerationId: status.activeGenerationId,
            servingManifestVersion,
            servingManifestActive,
            servingFileMtimeMs,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error("[DataFreshness] Error:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return c.json({ error: "Failed to check data freshness", details: errorMessage }, 500);
    }
});

export default dataFreshnessRoutes;
