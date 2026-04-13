import { getDuckDbRuntimeConfig } from "./config";
import { LeaseClosedError, QueryTimeoutError } from "./errors";
import { logDuckDbError } from "./logging";
import { recordMetric } from "./metrics";
import type { DuckDbConnection, DuckDbGeneration, DuckDbLease, QueryOptions } from "./types";

export class RequestDuckDbLease implements DuckDbLease {
  private closed = false;
  private connectionPromise: Promise<DuckDbConnection> | null = null;

  constructor(private readonly generation: DuckDbGeneration, private readonly onClose: () => Promise<void> | void) {}

  get generationId() {
    return this.generation.id;
  }

  get snapshot() {
    return this.generation.snapshot;
  }

  private async getConnection() {
    if (!this.connectionPromise) {
      this.connectionPromise = this.generation.instance.connect();
    }

    return this.connectionPromise;
  }

  async run<T>(queryName: string, run: (connection: DuckDbConnection) => Promise<T>, options?: QueryOptions): Promise<T> {
    if (this.closed) {
      throw new LeaseClosedError();
    }

    const config = getDuckDbRuntimeConfig();
    const timeoutMs = options?.timeoutMs ?? config.queryTimeoutMs;
    const startedAt = performance.now();
    const connection = await this.getConnection();

    try {
      const result = await Promise.race([
        run(connection),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new QueryTimeoutError(queryName, timeoutMs)), timeoutMs)
        ),
      ]);
      recordMetric("duckdb_query_duration_ms", performance.now() - startedAt, {
        queryName,
        generationId: this.generation.id,
        manifestVersion: this.generation.snapshot.manifestVersion,
      });
      return result;
    } catch (error) {
      logDuckDbError("query_failed", {
        queryName,
        generationId: this.generation.id,
        manifestVersion: this.generation.snapshot.manifestVersion,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async close() {
    if (this.closed) {
      return;
    }

    this.closed = true;
    const connection = this.connectionPromise ? await this.connectionPromise.catch(() => null) : null;
    if (connection) {
      connection.closeSync();
    }
    await this.onClose();
  }
}
