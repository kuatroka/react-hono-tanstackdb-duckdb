export function nowMs() {
  return Date.now();
}

export function logDuckDbEvent(event: string, payload: Record<string, unknown> = {}) {
  console.log(`[DuckDB] ${event}`, payload);
}

export function logDuckDbWarning(event: string, payload: Record<string, unknown> = {}) {
  console.warn(`[DuckDB] ${event}`, payload);
}

export function logDuckDbError(event: string, payload: Record<string, unknown> = {}) {
  console.error(`[DuckDB] ${event}`, payload);
}
