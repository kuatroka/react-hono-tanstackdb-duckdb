export type PerfSource =
  | 'api-duckdb'
  | 'tsdb-indexeddb'
  | 'tsdb-memory'
  | 'indexeddb'
  | 'memory'
  | 'unknown';

export type PerfSourceCategory = 'local' | 'cache' | 'api' | 'unknown';

export type PerfTelemetry = Readonly<{
  source: PerfSource;
  label: string;
  ms: number | null;
  primaryLine: string;
  secondaryLine?: string;
}>;

export function formatPerfLatencyMs(ms: number | null) {
  if (ms == null || !Number.isFinite(ms)) return '…';
  if (ms < 10) return `${ms.toFixed(2)}ms`;
  if (ms < 100) return `${ms.toFixed(1)}ms`;
  return `${ms.toFixed(0)}ms`;
}

export function formatPerfSourceLabel(source: PerfSource) {
  switch (source) {
    case 'api-duckdb':
      return 'API (DuckDB)';
    case 'tsdb-indexeddb':
      return 'TanStack DB (IndexedDB)';
    case 'tsdb-memory':
      return 'TanStack DB (memory)';
    case 'indexeddb':
      return 'IndexedDB';
    case 'memory':
      return 'browser memory';
    default:
      return 'unknown';
  }
}

export function getPerfSourceCategory(source: PerfSource): PerfSourceCategory {
  switch (source) {
    case 'tsdb-indexeddb':
    case 'indexeddb':
      return 'local';
    case 'tsdb-memory':
    case 'memory':
      return 'cache';
    case 'api-duckdb':
      return 'api';
    default:
      return 'unknown';
  }
}

export function toPerfSource(source: string): PerfSource {
  if (
    source === 'api-duckdb'
    || source === 'tsdb-indexeddb'
    || source === 'tsdb-memory'
    || source === 'indexeddb'
    || source === 'memory'
    || source === 'unknown'
  ) {
    return source;
  }

  if (source === 'tsdb-api' || source === 'rq-api' || source === 'api') {
    return 'api-duckdb';
  }

  return 'unknown';
}

export function createPerfTelemetry({
  label,
  ms,
  secondaryLabel,
  secondaryMs,
  source,
}: {
  label: string;
  ms: number | null;
  secondaryLabel?: string;
  secondaryMs?: number | null;
  source: PerfSource;
}): PerfTelemetry {
  const sourceLabel = formatPerfSourceLabel(source);
  const primaryLine = `${sourceLabel} ${label}: ${formatPerfLatencyMs(ms)}`;
  const secondaryLine = secondaryLabel
    ? `${sourceLabel} ${secondaryLabel}: ${formatPerfLatencyMs(secondaryMs ?? null)}`
    : undefined;

  return {
    source,
    label,
    ms,
    primaryLine,
    secondaryLine,
  };
}

export function createLegacyPerfTelemetry({
  label,
  ms,
  renderMs,
  source,
}: {
  label?: string;
  ms: number | null;
  renderMs?: number | null;
  source: string;
}): PerfTelemetry {
  const perfSource = toPerfSource(source);
  const resolvedLabel = label ?? 'data';

  return createPerfTelemetry({
    source: perfSource,
    label: resolvedLabel,
    ms,
    secondaryLabel: renderMs !== undefined ? 'render' : undefined,
    secondaryMs: renderMs,
  });
}
