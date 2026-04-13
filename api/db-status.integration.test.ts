import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { getMetricOverview } from "./db/metrics";
import dbStatusRoutes from "./routes/db-status";

describe("db status route", () => {
  test("returns operational DuckDB status payload with runtime config and metrics overview", async () => {
    const app = new Hono().basePath("/api");
    app.route("/db-status", dbStatusRoutes);

    const response = await app.request("/api/db-status");
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body).toHaveProperty("activeGenerationId");
    expect(body).toHaveProperty("activeSnapshot");
    expect(body).toHaveProperty("drainingGenerationIds");
    expect(body).toHaveProperty("generations");
    expect(body).toHaveProperty("runtimeMode");
    expect(body).toHaveProperty("refreshLoopActive");
    expect(typeof body.refreshIntervalMs).toBe("number");

    expect(body.runtimeConfig).toEqual({
      accessMode: "READ_ONLY",
      refreshIntervalMs: expect.any(Number),
      warmupTimeoutMs: expect.any(Number),
      queryTimeoutMs: expect.any(Number),
      drainTimeoutMs: expect.any(Number),
    });

    expect(body.metrics).toEqual(getMetricOverview());
  });
});
