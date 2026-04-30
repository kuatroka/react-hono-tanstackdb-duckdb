import { describe, expect, test } from "bun:test";
import type { DuckDbGeneration, DuckDbLease, ResolvedDbSnapshot } from "./types";
import { ManifestResolver } from "./manifest-resolver";
import { DuckDbGenerationManager } from "./generation-manager";
import { createDuckDbLeaseMiddleware } from "./hono-db-middleware";
import { Hono } from "hono";

function createSnapshot(version: number, active: "a" | "b" = "a", overrides: Partial<ResolvedDbSnapshot> = {}): ResolvedDbSnapshot {
  return {
    mode: "manifest",
    manifestVersion: version,
    manifestActive: active,
    dbPath: `/tmp/test-${version}-${active}.duckdb`,
    fileMtimeMs: version * 1000,
    source: "manifest",
    resolvedAt: Date.now(),
    ...overrides,
  };
}

describe("DuckDbGenerationManager", () => {
  test("keeps serving last active generation when warmup of next generation fails", async () => {
    const snapshots = [createSnapshot(1, "a"), createSnapshot(2, "b")];
    let snapshotIndex = 0;
    const resolver = {
      resolveSnapshot: () => snapshots[Math.min(snapshotIndex++, snapshots.length - 1)],
      getLastManifestError: () => null,
      getRuntimeMode: () => "manifest" as const,
    } as unknown as ManifestResolver;

    const createGenerationFn = async (snapshot: ResolvedDbSnapshot): Promise<DuckDbGeneration> => ({
      id: `gen-${snapshot.manifestVersion}`,
      snapshot,
      state: "warming",
      instance: {} as never,
      inFlightRequests: 0,
      createdAt: Date.now(),
      activatedAt: null,
      drainStartedAt: null,
      retiredAt: null,
      lastWarmupOkAt: null,
      lastWarmupError: null,
    });

    const warmupGenerationFn = async (generation: DuckDbGeneration) => {
      if (generation.snapshot.manifestVersion === 2) {
        throw new Error("warmup failed");
      }
      generation.lastWarmupOkAt = Date.now();
    };

    const retired: string[] = [];
    const manager = new DuckDbGenerationManager(
      resolver,
      createGenerationFn,
      warmupGenerationFn,
      async (generation) => {
        retired.push(generation.id);
        generation.state = "retired";
      }
    );

    const initialLease = await manager.acquireLease();
    expect(initialLease.snapshot.manifestVersion).toBe(1);
    await initialLease.close();

    await manager.refreshIfNeeded("admin");
    const status = await manager.getStatus();

    expect(status.activeSnapshot?.manifestVersion).toBe(1);
    expect(status.drainingGenerationIds).toEqual([]);
    expect(retired).toEqual([]);
  });

  test("drains old generation after rollover once in-flight lease closes", async () => {
    const snapshots = [createSnapshot(1, "a"), createSnapshot(2, "b")];
    let snapshotIndex = 0;
    const resolver = {
      resolveSnapshot: () => snapshots[Math.min(snapshotIndex++, snapshots.length - 1)],
      getLastManifestError: () => null,
      getRuntimeMode: () => "manifest" as const,
    } as unknown as ManifestResolver;

    const createGenerationFn = async (snapshot: ResolvedDbSnapshot): Promise<DuckDbGeneration> => ({
      id: `gen-${snapshot.manifestVersion}`,
      snapshot,
      state: "warming",
      instance: {} as never,
      inFlightRequests: 0,
      createdAt: Date.now(),
      activatedAt: null,
      drainStartedAt: null,
      retiredAt: null,
      lastWarmupOkAt: null,
      lastWarmupError: null,
    });

    const warmupGenerationFn = async (generation: DuckDbGeneration) => {
      generation.lastWarmupOkAt = Date.now();
    };

    const retired: string[] = [];
    const manager = new DuckDbGenerationManager(
      resolver,
      createGenerationFn,
      warmupGenerationFn,
      async (generation) => {
        retired.push(generation.id);
        generation.state = "retired";
      }
    );

    await manager.getStatus();
    const internalManager = manager as unknown as {
      activeGeneration: DuckDbGeneration;
      retireIfDrained: (generation: DuckDbGeneration) => Promise<void>;
    };
    const oldGeneration = internalManager.activeGeneration;
    oldGeneration.inFlightRequests = 1;

    await manager.refreshIfNeeded("admin");

    let status = await manager.getStatus();
    expect(status.activeSnapshot?.manifestVersion).toBe(2);
    expect(status.drainingGenerationIds).toEqual(["gen-1"]);
    expect(retired).toEqual([]);

    oldGeneration.inFlightRequests = 0;
    await internalManager.retireIfDrained(oldGeneration);

    status = await manager.getStatus();
    expect(status.drainingGenerationIds).toEqual([]);
    expect(retired).toEqual(["gen-1"]);
  });

  test("does not refresh on acquireLease and relies on timer/admin refreshes", async () => {
    const snapshots = [createSnapshot(1, "a"), createSnapshot(2, "b")];
    let snapshotIndex = 0;
    const resolver = {
      resolveSnapshot: () => snapshots[Math.min(snapshotIndex++, snapshots.length - 1)],
      getLastManifestError: () => null,
      getRuntimeMode: () => "manifest" as const,
    } as unknown as ManifestResolver;

    const createGenerationFn = async (snapshot: ResolvedDbSnapshot): Promise<DuckDbGeneration> => ({
      id: `gen-${snapshot.manifestVersion}`,
      snapshot,
      state: "warming",
      instance: {} as never,
      inFlightRequests: 0,
      createdAt: Date.now(),
      activatedAt: null,
      drainStartedAt: null,
      retiredAt: null,
      lastWarmupOkAt: null,
      lastWarmupError: null,
    });

    const manager = new DuckDbGenerationManager(
      resolver,
      createGenerationFn,
      async (generation) => {
        generation.lastWarmupOkAt = Date.now();
      },
      async (generation) => {
        generation.state = "retired";
      }
    );

    const firstLease = await manager.acquireLease();
    expect(firstLease.generationId).toBe("gen-1");
    await firstLease.close();

    const secondLease = await manager.acquireLease();
    expect(secondLease.generationId).toBe("gen-1");
    await secondLease.close();

    let status = await manager.getStatus();
    expect(status.activeGenerationId).toBe("gen-1");

    await manager.refreshIfNeeded("admin");
    status = await manager.getStatus();
    expect(status.activeGenerationId).toBe("gen-2");
  });
});

describe("duckDbLeaseMiddleware", () => {
  test("always closes request lease after request completion", async () => {
    let closed = 0;
    let acquired = 0;
    const snapshot = createSnapshot(1, "a");
    const middleware = createDuckDbLeaseMiddleware({
      acquireLease: async (): Promise<DuckDbLease> => {
        acquired += 1;
        return {
          generationId: `lease-${snapshot.manifestVersion}`,
          snapshot,
          run: async (_queryName, fn) => fn({} as never),
          close: async () => {
            closed += 1;
          },
        };
      },
    });

    const app = new Hono().basePath("/api");
    app.use("*", middleware);
    app.get("/assets", (c) => c.json({ ok: true }));

    const response = await app.request("/api/assets");
    expect(response.status).toBe(200);
    expect(acquired).toBe(1);
    expect(closed).toBe(1);
  });
});
