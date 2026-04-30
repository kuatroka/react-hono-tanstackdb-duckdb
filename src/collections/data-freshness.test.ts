import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'

const localStorageMock = {
  store: new Map<string, string>(),
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null
  },
  setItem(key: string, value: string) {
    this.store.set(key, value)
  },
  removeItem(key: string) {
    this.store.delete(key)
  },
  clear() {
    this.store.clear()
  },
}

describe('data freshness', () => {
  beforeEach(() => {
    mock.restore()
    localStorageMock.clear()
    ;(globalThis as typeof globalThis & { localStorage: typeof localStorageMock }).localStorage = localStorageMock
    ;(globalThis as typeof globalThis & { window: typeof globalThis }).window = globalThis
  })

  afterEach(() => {
    mock.restore()
    localStorageMock.clear()
  })

  test('invalidateAllCaches clears all memory-backed modules', async () => {
    const cikQuarterlyModule = await import('./cik-quarterly')
    const assetActivityModule = await import('./asset-activity')
    const investorFlowModule = await import('./investor-flow')
    const assetsModule = await import('./assets')
    const investorDetailsModule = await import('./investor-details')
    const superinvestorAssetHistoryModule = await import('./superinvestor-asset-history')
    const searchesModule = await import('./searches')
    const superinvestorsModule = await import('./superinvestors')
    const queryClientModule = await import('./query-client')
    const dexieDbModule = await import('@/lib/dexie-db')
    const dataFreshnessModule = await import('./data-freshness')

    const clearSpy = spyOn(queryClientModule.queryClient, 'clear')
    const clearCikSpy = spyOn(cikQuarterlyModule, 'clearAllCikQuarterlyData')
    const clearAssetSpy = spyOn(assetActivityModule, 'clearAllAssetActivityData')
    const clearFlowSpy = spyOn(investorFlowModule, 'clearAllInvestorFlowData')
    const clearAssetListSpy = spyOn(assetsModule, 'clearAssetListSessionState')
    const clearDrilldownSessionSpy = spyOn(investorDetailsModule, 'clearDrilldownSessionState')
    const clearDrilldownSpy = spyOn(investorDetailsModule, 'clearAllDrilldownData')
    const clearHistorySpy = spyOn(superinvestorAssetHistoryModule, 'clearAllSuperinvestorAssetHistoryData')
    const clearSuperinvestorListSpy = spyOn(superinvestorsModule, 'clearSuperinvestorListSessionState')
    const resetSearchSpy = spyOn(searchesModule, 'resetSearchIndexState')
    const invalidateDexieSpy = spyOn(dexieDbModule, 'invalidateDatabase').mockResolvedValue()

    await dataFreshnessModule.invalidateAllCaches()

    expect(clearSpy).toHaveBeenCalledTimes(1)
    expect(clearCikSpy).toHaveBeenCalledTimes(1)
    expect(clearAssetSpy).toHaveBeenCalledTimes(1)
    expect(clearFlowSpy).toHaveBeenCalledTimes(1)
    expect(clearAssetListSpy).toHaveBeenCalledTimes(1)
    expect(clearDrilldownSessionSpy).toHaveBeenCalledTimes(1)
    expect(clearDrilldownSpy).toHaveBeenCalledTimes(1)
    expect(clearHistorySpy).toHaveBeenCalledTimes(1)
    expect(clearSuperinvestorListSpy).toHaveBeenCalledTimes(1)
    expect(resetSearchSpy).toHaveBeenCalledTimes(1)
    expect(invalidateDexieSpy).toHaveBeenCalledTimes(1)
  })

  test('checkDataFreshness compares generation-aware server dataVersion', async () => {
    localStorage.setItem(
      'app-data-version',
      JSON.stringify({ dataVersion: '1:a:100:noload', lastDataLoadDate: null, checkedAt: Date.now() }),
    )
    const dataFreshnessModule = await import('./data-freshness')

    spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          lastDataLoadDate: '2026-04-22T06:00:00Z',
          servingManifestVersion: 2,
          servingManifestActive: 'b',
          servingFileMtimeMs: 200,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const result = await dataFreshnessModule.checkDataFreshness()

    expect(result.isStale).toBe(true)
    expect(result.serverVersion).toBe('2:b:200:2026-04-22T06:00:00Z')
    expect(result.localVersion).toBe('1:a:100:noload')
  })
})
