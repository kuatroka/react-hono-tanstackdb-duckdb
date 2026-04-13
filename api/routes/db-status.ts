import { Hono } from "hono";
import { getMetricOverview } from "../db/metrics";
import { duckDbGenerationManager } from "../db/generation-manager";
import { getDuckDbRuntimeConfig } from "../db/config";

const dbStatusRoutes = new Hono();

dbStatusRoutes.get("/", async (c) => {
  const status = await duckDbGenerationManager.getStatus();
  const runtime = getDuckDbRuntimeConfig();
  return c.json({
    ok: true,
    ...status,
    runtimeConfig: {
      accessMode: runtime.accessMode,
      refreshIntervalMs: runtime.refreshIntervalMs,
      warmupTimeoutMs: runtime.warmupTimeoutMs,
      queryTimeoutMs: runtime.queryTimeoutMs,
      drainTimeoutMs: runtime.drainTimeoutMs,
    },
    metrics: getMetricOverview(),
  });
});

export default dbStatusRoutes;
