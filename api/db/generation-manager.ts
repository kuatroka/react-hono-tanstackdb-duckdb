import { getDuckDbRuntimeConfig } from "./config";
import { logDuckDbEvent, logDuckDbWarning } from "./logging";
import { ManifestResolver, manifestResolver } from "./manifest-resolver";
import { recordMetric } from "./metrics";
import { RequestDuckDbLease } from "./request-db";
import { createGeneration } from "./generation-factory";
import { retireGeneration } from "./generation-retirement";
import { warmupGeneration } from "./generation-warmup";
import type { DuckDbGeneration, DuckDbLease, GenerationManagerStatus, ResolvedDbSnapshot } from "./types";

function snapshotsEqual(a: ResolvedDbSnapshot | null, b: ResolvedDbSnapshot | null) {
  if (!a || !b) {
    return false;
  }

  return (
    a.mode === b.mode &&
    a.manifestVersion === b.manifestVersion &&
    a.manifestActive === b.manifestActive &&
    a.dbPath === b.dbPath &&
    a.fileMtimeMs === b.fileMtimeMs
  );
}

export class DuckDbGenerationManager {
  constructor(
    private readonly resolver: ManifestResolver = manifestResolver,
    private readonly createGenerationFn: typeof createGeneration = createGeneration,
    private readonly warmupGenerationFn: typeof warmupGeneration = warmupGeneration,
    private readonly retireGenerationFn: typeof retireGeneration = retireGeneration
  ) {}

  private activeGeneration: DuckDbGeneration | null = null;
  private drainingGenerations = new Map<string, DuckDbGeneration>();
  private knownGenerations = new Map<string, DuckDbGeneration>();
  private refreshPromise: Promise<void> | null = null;
  private refreshTimer: Timer | null = null;
  private lastRefreshAt: number | null = null;
  private initialized = false;
  private requestRefreshDisabled = true;

  private startRefreshLoop() {
    if (this.refreshTimer) {
      return;
    }

    const { refreshIntervalMs } = getDuckDbRuntimeConfig();
    if (refreshIntervalMs <= 0) {
      return;
    }

    this.refreshTimer = setInterval(() => {
      void this.refreshIfNeeded("timer");
    }, refreshIntervalMs);

    logDuckDbEvent("generation_refresh_loop_started", {
      refreshIntervalMs,
    });
  }

  private async ensureInitialized() {
    if (this.initialized && this.activeGeneration) {
      return;
    }

    const snapshot = this.resolver.resolveSnapshot();
    const generation = await this.createGenerationFn(snapshot);
    await this.warmupGenerationFn(generation);
    generation.state = "active";
    generation.activatedAt = Date.now();
    this.activeGeneration = generation;
    this.knownGenerations.set(generation.id, generation);
    this.initialized = true;
    this.lastRefreshAt = Date.now();
    this.startRefreshLoop();
    logDuckDbEvent("generation_activated", {
      generationId: generation.id,
      manifestVersion: generation.snapshot.manifestVersion,
      dbPath: generation.snapshot.dbPath,
    });
  }

  async refreshIfNeeded(reason: "request" | "timer" | "admin" = "request") {
    await this.ensureInitialized();
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const nextSnapshot = this.resolver.resolveSnapshot();
        if (snapshotsEqual(this.activeGeneration?.snapshot ?? null, nextSnapshot)) {
          this.lastRefreshAt = Date.now();
          recordMetric("duckdb_generation_refresh_checks_total", 1, {
            reason,
            changed: false,
            activeGeneration: this.activeGeneration?.id ?? null,
          });
          return;
        }

        const nextGeneration = await this.createGenerationFn(nextSnapshot);
        this.knownGenerations.set(nextGeneration.id, nextGeneration);
        await this.warmupGenerationFn(nextGeneration);
        nextGeneration.state = "active";
        nextGeneration.activatedAt = Date.now();

        const previousGeneration = this.activeGeneration;
        this.activeGeneration = nextGeneration;
        this.lastRefreshAt = Date.now();
        recordMetric("duckdb_generation_refresh_checks_total", 1, {
          reason,
          changed: true,
          fromGeneration: previousGeneration?.id ?? null,
          toGeneration: nextGeneration.id,
        });
        recordMetric("duckdb_generation_rollover_total", 1, {
          reason,
          fromGeneration: previousGeneration?.id ?? null,
          toGeneration: nextGeneration.id,
          manifestVersion: nextGeneration.snapshot.manifestVersion,
        });

        logDuckDbEvent("generation_swapped", {
          reason,
          fromGeneration: previousGeneration?.id ?? null,
          toGeneration: nextGeneration.id,
          manifestVersion: nextGeneration.snapshot.manifestVersion,
          dbPath: nextGeneration.snapshot.dbPath,
        });

        if (previousGeneration) {
          previousGeneration.state = "draining";
          previousGeneration.drainStartedAt = Date.now();
          this.drainingGenerations.set(previousGeneration.id, previousGeneration);
          await this.retireIfDrained(previousGeneration);
        }
      } catch (error) {
        recordMetric("duckdb_generation_rollover_failures_total", 1, {
          reason,
          error: error instanceof Error ? error.message : String(error),
        });
        logDuckDbWarning("generation_refresh_failed", {
          reason,
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  async acquireLease(): Promise<DuckDbLease> {
    await this.ensureInitialized();
    if (!this.requestRefreshDisabled) {
      await this.refreshIfNeeded("request");
    }

    const generation = this.activeGeneration;
    if (!generation) {
      throw new Error("DuckDB generation manager is not initialized");
    }

    generation.inFlightRequests += 1;
    recordMetric("duckdb_generation_inflight_requests", generation.inFlightRequests, {
      generationId: generation.id,
      manifestVersion: generation.snapshot.manifestVersion,
    });

    return new RequestDuckDbLease(generation, async () => {
      generation.inFlightRequests = Math.max(0, generation.inFlightRequests - 1);
      await this.retireIfDrained(generation);
    });
  }

  private async retireIfDrained(generation: DuckDbGeneration) {
    if (generation.state !== "draining" || generation.inFlightRequests > 0) {
      return;
    }

    this.drainingGenerations.delete(generation.id);
    await this.retireGenerationFn(generation);
  }

  async getStatus(): Promise<GenerationManagerStatus> {
    await this.ensureInitialized();
    return {
      activeGenerationId: this.activeGeneration?.id ?? null,
      activeSnapshot: this.activeGeneration?.snapshot ?? null,
      drainingGenerationIds: [...this.drainingGenerations.keys()],
      generations: [...this.knownGenerations.values()].map((generation) => ({
        id: generation.id,
        state: generation.state,
        manifestVersion: generation.snapshot.manifestVersion,
        manifestActive: generation.snapshot.manifestActive,
        inFlightRequests: generation.inFlightRequests,
        createdAt: generation.createdAt,
        activatedAt: generation.activatedAt,
        drainStartedAt: generation.drainStartedAt,
        lastWarmupOkAt: generation.lastWarmupOkAt,
        lastWarmupError: generation.lastWarmupError,
      })),
      lastManifestError: this.resolver.getLastManifestError(),
      lastRefreshAt: this.lastRefreshAt,
      runtimeMode: this.resolver.getRuntimeMode(),
      refreshLoopActive: this.refreshTimer !== null,
      refreshIntervalMs: getDuckDbRuntimeConfig().refreshIntervalMs,
    };
  }

  async shutdown() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
      logDuckDbEvent("generation_refresh_loop_stopped");
    }

    for (const generation of this.drainingGenerations.values()) {
      if (generation.inFlightRequests === 0) {
        await this.retireGenerationFn(generation);
      }
    }

    if (this.activeGeneration) {
      if (this.activeGeneration.inFlightRequests === 0) {
        await this.retireGenerationFn(this.activeGeneration);
      } else {
        this.activeGeneration.state = "draining";
        this.activeGeneration.drainStartedAt = Date.now();
        this.drainingGenerations.set(this.activeGeneration.id, this.activeGeneration);
      }
    }
  }
}

export const duckDbGenerationManager = new DuckDbGenerationManager();
