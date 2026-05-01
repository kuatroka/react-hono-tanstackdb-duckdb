type MetricRecord = {
  name: string;
  value: number;
  tags?: Record<string, string | number | boolean | null>;
  recordedAt: number;
};

export type MetricSummary = {
  name: string;
  latestValue: number;
  latestTags: MetricRecord["tags"] | null;
  recordedAt: number;
  samples: number;
};

const MAX_METRIC_SAMPLES = 10_000;
const metricSink: MetricRecord[] = [];

export function recordMetric(name: string, value: number, tags?: MetricRecord["tags"]) {
  metricSink.push({ name, value, tags, recordedAt: Date.now() });
  if (metricSink.length > MAX_METRIC_SAMPLES) {
    metricSink.splice(0, metricSink.length - MAX_METRIC_SAMPLES);
  }
}

export function getRecordedMetrics() {
  return [...metricSink];
}

export function getMetricSummary(): MetricSummary[] {
  const lastByName = new Map<string, MetricRecord>();
  const countByName = new Map<string, number>();

  for (const metric of metricSink) {
    lastByName.set(metric.name, metric);
    countByName.set(metric.name, (countByName.get(metric.name) ?? 0) + 1);
  }

  return [...lastByName.entries()].map(([name, metric]) => ({
    name,
    latestValue: metric.value,
    latestTags: metric.tags ?? null,
    recordedAt: metric.recordedAt,
    samples: countByName.get(name) ?? 0,
  }));
}

export function getMetricOverview() {
  const summary = getMetricSummary();
  return {
    totalSamples: metricSink.length,
    metricNames: summary.length,
    lastRecordedAt: metricSink.at(-1)?.recordedAt ?? null,
    summary,
  };
}

export function clearRecordedMetrics() {
  metricSink.length = 0;
}
