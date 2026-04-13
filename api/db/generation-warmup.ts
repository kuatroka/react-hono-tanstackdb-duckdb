import { getDuckDbRuntimeConfig } from "./config";
import { GenerationWarmupError } from "./errors";
import { recordMetric } from "./metrics";
import type { DuckDbGeneration } from "./types";

const WARMUP_QUERIES = [
  "SELECT 1 AS ok",
  "SELECT last_data_load_date FROM high_level_totals LIMIT 1",
  "SELECT asset, cusip FROM assets LIMIT 1",
];

export async function warmupGeneration(generation: DuckDbGeneration) {
  const startedAt = performance.now();
  const connection = await generation.instance.connect();

  try {
    for (const sql of WARMUP_QUERIES) {
      const config = getDuckDbRuntimeConfig();
      await Promise.race([
        connection.run(sql),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new GenerationWarmupError(`Warmup query timed out: ${sql}`)),
            config.warmupTimeoutMs
          )
        ),
      ]);
    }

    generation.lastWarmupOkAt = Date.now();
    generation.lastWarmupError = null;
    recordMetric("duckdb_generation_warmup_duration_ms", performance.now() - startedAt, {
      generationId: generation.id,
      manifestVersion: generation.snapshot.manifestVersion,
    });
  } catch (error) {
    generation.lastWarmupError = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    connection.closeSync();
  }
}
