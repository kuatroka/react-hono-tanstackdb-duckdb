import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { createDuckDbLeaseMiddleware } from "./db/hono-db-middleware";
import { DUCKDB_LEASE_CONTEXT_KEY } from "./db/hono-types";
import type { DuckDbLease, ResolvedDbSnapshot } from "./db/types";

function createSnapshot(version: number, active: "a" | "b" = "a"): ResolvedDbSnapshot {
  return {
    mode: "manifest",
    manifestVersion: version,
    manifestActive: active,
    dbPath: `/tmp/test-${version}-${active}.duckdb`,
    fileMtimeMs: version * 1000,
    source: "manifest",
    resolvedAt: Date.now(),
  };
}

describe("duckdb rollover integration", () => {
  test("in-flight request stays on old generation while new request gets promoted generation", async () => {
    const firstSnapshot = createSnapshot(1, "a");
    const secondSnapshot = createSnapshot(2, "b");

    let callCount = 0;
    const closeCalls: string[] = [];
    const middleware = createDuckDbLeaseMiddleware({
      acquireLease: async (): Promise<DuckDbLease> => {
        callCount += 1;
        const snapshot = callCount === 1 ? firstSnapshot : secondSnapshot;
        return {
          generationId: `lease-${snapshot.manifestVersion}`,
          snapshot,
          run: async (_queryName, fn) => fn({} as never),
          close: async () => {
            closeCalls.push(`lease-${snapshot.manifestVersion}`);
          },
        };
      },
    });

    const app = new Hono().basePath("/api");
    app.use("*", middleware);
    app.get("/test", async (c) => {
      const lease = c.get(DUCKDB_LEASE_CONTEXT_KEY);
      const pauseMs = Number(c.req.query("pauseMs") || "0");
      if (pauseMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, pauseMs));
      }
      return c.json({ generationId: lease.generationId, manifestVersion: lease.snapshot.manifestVersion });
    });

    const slowRequestPromise = app.request("/api/test?pauseMs=50");
    await new Promise((resolve) => setTimeout(resolve, 5));
    const fastResponse = await app.request("/api/test");
    const slowResponse = await slowRequestPromise;

    expect(fastResponse.status).toBe(200);
    expect(slowResponse.status).toBe(200);

    expect(await fastResponse.json()).toEqual({ generationId: "lease-2", manifestVersion: 2 });
    expect(await slowResponse.json()).toEqual({ generationId: "lease-1", manifestVersion: 1 });
    expect(closeCalls.sort()).toEqual(["lease-1", "lease-2"]);
  });
});
