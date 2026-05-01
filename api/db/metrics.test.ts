import { describe, expect, test } from 'bun:test'
import { clearRecordedMetrics, getMetricOverview, recordMetric } from './metrics'

describe('metrics sink', () => {
  test('retains only the most recent bounded sample window', () => {
    clearRecordedMetrics()

    for (let index = 0; index < 10050; index += 1) {
      recordMetric('metric.test', index)
    }

    const overview = getMetricOverview()
    expect(overview.totalSamples).toBe(10000)
    expect(overview.summary[0]?.latestValue).toBe(10049)
  })
})
