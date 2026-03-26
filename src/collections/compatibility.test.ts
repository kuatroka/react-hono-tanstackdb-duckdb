import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const packageJson = JSON.parse(
  readFileSync(join(import.meta.dir, '../../package.json'), 'utf8')
) as {
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
}

describe('TanStack package compatibility', () => {
  test('uses the known-compatible TanStack dependency set for live collections', () => {
    expect(packageJson.dependencies['@tanstack/db']).toBe('0.5.11')
    expect(packageJson.dependencies['@tanstack/query-db-collection']).toBe('1.0.6')
    expect(packageJson.dependencies['@tanstack/query-persist-client-core']).toBe('5.91.11')
    expect(packageJson.dependencies['@tanstack/react-db']).toBe('0.1.55')
    expect(packageJson.dependencies['@tanstack/react-query']).toBe('5.90.12')
    expect(packageJson.dependencies['@tanstack/react-router']).toBe('1.139.14')
    expect(packageJson.dependencies['@tanstack/react-start']).toBe('1.139.14')
    expect(packageJson.devDependencies['@tanstack/router-plugin']).toBe('1.139.14')
  })
})
