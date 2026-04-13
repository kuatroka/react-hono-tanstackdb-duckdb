import { recordMetric } from "./metrics";
import type { DuckDbGeneration } from "./types";

export async function retireGeneration(generation: DuckDbGeneration) {
  if (generation.state === "retired") {
    return;
  }

  generation.instance.closeSync();
  generation.state = "retired";
  generation.retiredAt = Date.now();
  recordMetric("duckdb_generation_retired_total", 1, {
    generationId: generation.id,
    manifestVersion: generation.snapshot.manifestVersion,
  });
}
