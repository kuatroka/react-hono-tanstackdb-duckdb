import { afterEach, describe, expect, test } from 'bun:test'
import { getDuckDbRuntimeConfig } from './config'

describe('duckdb runtime config', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  test('requires DUCKDB_PATH explicitly', () => {
    delete process.env.DUCKDB_PATH

    expect(() => getDuckDbRuntimeConfig()).toThrow('Missing required environment variable: DUCKDB_PATH')
  })

  test('defaults refresh interval to 5 minutes', () => {
    process.env.DUCKDB_PATH = '/tmp/test.duckdb'
    delete process.env.DUCKDB_REFRESH_INTERVAL_MS

    const config = getDuckDbRuntimeConfig()

    expect(config.refreshIntervalMs).toBe(300000)
  })
})
