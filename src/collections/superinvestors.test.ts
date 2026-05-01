import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { QueryClient } from '@tanstack/query-core'
import * as queryClientModule from './query-client'
import { clearSuperinvestorListSessionState, createSuperinvestorsCollection, getLoadedSuperinvestorList } from './superinvestors'

describe('superinvestors collection', () => {
  afterEach(() => {
    mock.restore()
  })

  test('hydrates from the wrapped superinvestors API response', async () => {
    const rows = [
      {
        id: '898371',
        cik: '898371',
        cikName: 'Citadel Advisors',
      },
    ]

    const fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ rows, totalCount: 1, complete: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const collection = createSuperinvestorsCollection(new QueryClient())
    await collection.preload()

    expect(fetchSpy).toHaveBeenCalledWith('/api/superinvestors?limit=20000&offset=0')
    expect(Array.from(collection.entries()).map(([, value]) => value)).toMatchObject(rows)
    expect(getLoadedSuperinvestorList()).toMatchObject(rows)
  })

  test('reuses persisted IndexedDB rows on repeat visits without another superinvestors API fetch', async () => {
    const rows = [
      {
        id: '1067983',
        cik: '1067983',
        cikName: 'Berkshire Hathaway',
      },
    ]

    const superinvestorListCacheId = 'superinvestors-v1'

    spyOn(queryClientModule, 'loadPersistedSuperinvestorListData').mockResolvedValue({
      key: superinvestorListCacheId,
      rows,
      metadata: { persistedAt: Date.now(), dataVersion: null },
    })
    const fetchSpy = spyOn(globalThis, 'fetch')

    const collection = createSuperinvestorsCollection(new QueryClient())
    await collection.preload()

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(Array.from(collection.entries()).map(([, value]) => value)).toMatchObject(rows)
    expect(getLoadedSuperinvestorList()).toMatchObject(rows)
  })

  test('clears collection-backed list rows without retaining a duplicate module array', async () => {
    const rows = [
      {
        id: '1656456',
        cik: '1656456',
        cikName: 'Scion Asset Management',
      },
    ]

    spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ rows, totalCount: 1, complete: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const queryClient = new QueryClient()
    const collection = createSuperinvestorsCollection(queryClient)
    await collection.preload()
    expect(queryClient.getQueryCache().find({ queryKey: ['superinvestors'] })).toBeDefined()
    expect(getLoadedSuperinvestorList()).toHaveLength(1)

    clearSuperinvestorListSessionState()

    expect(getLoadedSuperinvestorList()).toEqual([])
    expect(queryClient.getQueryCache().find({ queryKey: ['superinvestors'] })).toBeUndefined()
  })
})
