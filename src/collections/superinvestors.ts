import { createCollection } from '@tanstack/db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import type { QueryClient } from '@tanstack/query-core'
import { loadPersistedSuperinvestorListData, persistSuperinvestorListData } from './query-client'

export type SuperinvestorListLoadSource = 'memory' | 'indexeddb' | 'api'

const superinvestorListSourceListeners = new Set<(source: SuperinvestorListLoadSource) => void>()
let currentSuperinvestorListLoadSource: SuperinvestorListLoadSource = 'memory'

function setSuperinvestorListLoadSource(source: SuperinvestorListLoadSource) {
    currentSuperinvestorListLoadSource = source
    for (const listener of superinvestorListSourceListeners) {
        listener(source)
    }
}

export function getSuperinvestorListLoadSource(): SuperinvestorListLoadSource {
    return currentSuperinvestorListLoadSource
}

export function subscribeSuperinvestorListLoadSource(listener: (source: SuperinvestorListLoadSource) => void): () => void {
    superinvestorListSourceListeners.add(listener)
    return () => superinvestorListSourceListeners.delete(listener)
}

export interface Superinvestor {
    id: string
    cik: string
    cikName: string
}

export async function fetchSuperinvestorRecordWithSource(cik: string): Promise<{
    record: Superinvestor | null
    source: SuperinvestorListLoadSource | 'unknown'
}> {
    const normalizedCik = cik.trim()
    const cachedRecord = Array.from(superinvestorsCollection.entries()).find(([, value]) => value.cik === normalizedCik)?.[1] ?? null
    if (cachedRecord) {
        return { record: cachedRecord, source: 'memory' }
    }

    const persisted = await loadPersistedSuperinvestorListData()
    const persistedRecord = persisted?.rows.find((row) => row.cik === normalizedCik) ?? null
    if (persistedRecord) {
        return { record: persistedRecord as Superinvestor, source: 'indexeddb' }
    }

    const response = await fetch(`/api/superinvestors/${encodeURIComponent(normalizedCik)}`)

    if (response.status === 404) {
        return { record: null, source: 'unknown' }
    }

    if (!response.ok) {
        throw new Error('Failed to fetch superinvestor')
    }

    return {
        record: await response.json() as Superinvestor,
        source: 'api',
    }
}

export async function fetchSuperinvestorRecord(cik: string): Promise<Superinvestor | null> {
    const result = await fetchSuperinvestorRecordWithSource(cik)
    return result.record
}

// Factory function to create superinvestors collection with queryClient
// Restores from IndexedDB first, then refreshes from the DuckDB API.
const inFlightSuperinvestorListLoads = new Map<string, Promise<Superinvestor[]>>()

export function createSuperinvestorsCollection(queryClient: QueryClient) {
    const collection = createCollection(
        queryCollectionOptions({
            queryKey: ['superinvestors'],
            queryFn: async () => {
                const queryKey = 'superinvestors'
                const inFlight = inFlightSuperinvestorListLoads.get(queryKey)
                if (inFlight) {
                    return inFlight
                }

                const loadPromise = (async () => {
                    const persisted = await loadPersistedSuperinvestorListData()
                    if (persisted && persisted.rows.length > 0) {
                        setSuperinvestorListLoadSource('indexeddb')
                        void fetch('/api/superinvestors')
                            .then(async (res) => {
                                if (!res.ok) throw new Error('Failed to refresh superinvestors')
                                const superinvestors = await res.json() as Superinvestor[]
                                await persistSuperinvestorListData(superinvestors)
                            })
                            .catch((error) => {
                                console.warn('[Superinvestors] Background refresh failed:', error)
                            })

                        return persisted.rows as Superinvestor[]
                    }

                    const startTime = performance.now()
                    const res = await fetch('/api/superinvestors')
                    if (!res.ok) throw new Error('Failed to fetch superinvestors')
                    const superinvestors = await res.json() as Superinvestor[]
                    setSuperinvestorListLoadSource('api')
                    console.log(`[Superinvestors] Fetched ${superinvestors.length} superinvestors in ${Math.round(performance.now() - startTime)}ms`)
                    void persistSuperinvestorListData(superinvestors)
                    return superinvestors
                })()

                inFlightSuperinvestorListLoads.set(queryKey, loadPromise)
                try {
                    return await loadPromise
                } finally {
                    inFlightSuperinvestorListLoads.delete(queryKey)
                }
            },
            queryClient,
            getKey: (item) => item.cik,
            syncMode: 'eager',
        })
    )

    superinvestorsCollection = collection
    return collection
}

// Singleton instance - will be initialized in instances.ts
export let superinvestorsCollection: ReturnType<typeof createSuperinvestorsCollection>
