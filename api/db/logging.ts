export function nowMs() {
  return Date.now();
}

const SENSITIVE_KEY_PATTERN = /authorization|cookie|token|secret|password|jwt|api[-_]?key/i;

export function scrubLogPayload(payload: Record<string, unknown> = {}) {
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? "[redacted]" : value,
    ]),
  );
}

export function logDuckDbEvent(event: string, payload: Record<string, unknown> = {}) {
  console.log(`[DuckDB] ${event}`, scrubLogPayload(payload));
}

export function logDuckDbWarning(event: string, payload: Record<string, unknown> = {}) {
  console.warn(`[DuckDB] ${event}`, scrubLogPayload(payload));
}

export function logDuckDbError(event: string, payload: Record<string, unknown> = {}) {
  console.error(`[DuckDB] ${event}`, scrubLogPayload(payload));
}
