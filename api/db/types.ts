import type { DuckDBInstance } from "@duckdb/node-api";

export type DuckDbInstance = DuckDBInstance;
export type DuckDbConnection = Awaited<ReturnType<DuckDBInstance["connect"]>>;

export type DbMode = "manifest" | "legacy-single-file";
export type ManifestActive = "a" | "b";
export type GenerationState = "warming" | "active" | "draining" | "retired" | "failed";

export interface DbManifest {
  active: ManifestActive;
  version: number;
  lastUpdated?: string;
}

export interface ResolvedDbSnapshot {
  mode: DbMode;
  manifestVersion: number | null;
  manifestActive: ManifestActive | null;
  dbPath: string;
  fileMtimeMs: number | null;
  source: "manifest" | "fallback-env" | "fallback-versioned-file";
  resolvedAt: number;
}

export interface DuckDbGeneration {
  id: string;
  snapshot: ResolvedDbSnapshot;
  state: GenerationState;
  instance: DuckDbInstance;
  inFlightRequests: number;
  createdAt: number;
  activatedAt: number | null;
  drainStartedAt: number | null;
  retiredAt: number | null;
  lastWarmupOkAt: number | null;
  lastWarmupError: string | null;
}

export interface QueryOptions {
  timeoutMs?: number;
}

export interface DuckDbLease {
  generationId: string;
  snapshot: ResolvedDbSnapshot;
  run<T>(queryName: string, run: (connection: DuckDbConnection) => Promise<T>, options?: QueryOptions): Promise<T>;
  close(): Promise<void>;
}

export interface GenerationManagerStatus {
  activeGenerationId: string | null;
  activeSnapshot: ResolvedDbSnapshot | null;
  drainingGenerationIds: string[];
  generations: Array<{
    id: string;
    state: GenerationState;
    manifestVersion: number | null;
    manifestActive: ManifestActive | null;
    inFlightRequests: number;
    createdAt: number;
    activatedAt: number | null;
    drainStartedAt: number | null;
    lastWarmupOkAt: number | null;
    lastWarmupError: string | null;
  }>;
  lastManifestError: string | null;
  lastRefreshAt: number | null;
  runtimeMode: DbMode | null;
  refreshLoopActive: boolean;
  refreshIntervalMs: number;
}
