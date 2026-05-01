import { createCollection } from '@tanstack/db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import type { QueryClient } from '@tanstack/query-core'
import { loadPersistedSuperinvestorListData, persistSuperinvestorListData } from './query-client'

export type SuperinvestorListLoadSource = 'memory' | 'indexeddb' | 'api'

const superinvestorListSourceListeners = new Set<(source: SuperinvestorListLoadSource) => void>()
let currentSuperinvestorListLoadSource: SuperinvestorListLoadSource = 'memory'
let superinvestorListQueryClient: QueryClient | null = null

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

export function getLoadedSuperinvestorList(): Superinvestor[] {
    return superinvestorsCollection ? Array.from(superinvestorsCollection.entries()).map(([, value]) => value as Superinvestor) : []
}

export function clearSuperinvestorListSessionState(): void {
    const ids = getLoadedSuperinvestorList().map((row) => row.cik)
    if (ids.length > 0 && superinvestorsCollection?.isReady()) {
        superinvestorsCollection.utils.writeDelete(ids)
    }
    superinvestorListQueryClient?.removeQueries({ queryKey: ['superinvestors'] })
    inFlightSuperinvestorListLoads.clear()
    currentSuperinvestorListLoadSource = 'memory'
}

export async function fetchSuperinvestorRecordWithSource(cik: string): Promise<{
    record: Superinvestor | null
    source: SuperinvestorListLoadSource | 'unknown'
}> {
    const normalizedCik = cik.trim()
    const cachedRecord = getLoadedSuperinvestorList().find((value) => value.cik === normalizedCik) ?? null
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

interface SuperinvestorListResponse {
    rows?: Superinvestor[]
    complete?: boolean
    nextOffset?: number | null
}

async function fetchFullSuperinvestorList(): Promise<Superinvestor[]> {
    const allRows: Superinvestor[] = []
    let offset = 0
    const limit = 20000

    while (true) {
        const res = await fetch(`/api/superinvestors?limit=${limit}&offset=${offset}`)
        if (!res.ok) throw new Error('Failed to fetch superinvestors')

        const payload = await res.json() as SuperinvestorListResponse
        const rows = Array.isArray(payload.rows) ? payload.rows : []
        allRows.push(...rows)

        if (payload.complete !== false || payload.nextOffset == null || rows.length === 0) {
            break
        }

        offset = payload.nextOffset
    }

    return allRows
}

// Factory function to create superinvestors collection with queryClient
// Restores from IndexedDB first; freshness/version checks invalidate stale Dexie data.
const inFlightSuperinvestorListLoads = new Map<string, Promise<Superinvestor[]>>()

export function createSuperinvestorsCollection(queryClient: QueryClient) {
    superinvestorListQueryClient = queryClient

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
                        return persisted.rows as Superinvestor[]
                    }

                    const startTime = performance.now()
                    const superinvestors = await fetchFullSuperinvestorList()
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
