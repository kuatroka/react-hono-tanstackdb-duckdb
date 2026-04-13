import { DuckDBInstance } from "@duckdb/node-api";
import { getDuckDbRuntimeConfig } from "./config";
import type { DuckDbGeneration, ResolvedDbSnapshot } from "./types";

let generationCounter = 0;

export async function createGeneration(snapshot: ResolvedDbSnapshot): Promise<DuckDbGeneration> {
  const config = getDuckDbRuntimeConfig();
  const instance = await DuckDBInstance.create(snapshot.dbPath, {
    threads: config.threads,
    access_mode: config.accessMode,
  });

  generationCounter += 1;

  return {
    id: `gen-${generationCounter}`,
    snapshot,
    state: "warming",
    instance,
    inFlightRequests: 0,
    createdAt: Date.now(),
    activatedAt: null,
    drainStartedAt: null,
    retiredAt: null,
    lastWarmupOkAt: null,
    lastWarmupError: null,
  };
}
