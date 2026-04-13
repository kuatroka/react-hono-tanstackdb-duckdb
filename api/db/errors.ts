export class ManifestResolutionError extends Error {
  constructor(message: string, public readonly causeValue?: unknown) {
    super(message);
    this.name = "ManifestResolutionError";
  }
}

export class GenerationWarmupError extends Error {
  constructor(message: string, public readonly causeValue?: unknown) {
    super(message);
    this.name = "GenerationWarmupError";
  }
}

export class LeaseClosedError extends Error {
  constructor() {
    super("DuckDB lease is already closed");
    this.name = "LeaseClosedError";
  }
}

export class QueryTimeoutError extends Error {
  constructor(queryName: string, timeoutMs: number) {
    super(`DuckDB query '${queryName}' exceeded timeout of ${timeoutMs}ms`);
    this.name = "QueryTimeoutError";
  }
}
