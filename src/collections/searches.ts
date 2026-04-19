import { createCollection } from '@tanstack/db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import { QueryClient } from '@tanstack/query-core'
import { 
    queryClient as sharedQueryClient, 
    loadPersistedSearchIndex, 
    persistSearchIndex,
    type PersistedSearchIndex 
} from './query-client'
import {
    compactSearchIndexPayload,
    tupleToSearchIndexRecord,
    recordToSearchIndexTuple,
    type CompactSearchIndexPayload,
} from '@/lib/search-index'

export interface SearchResult {
    id: number
    cusip: string | null
    code: string
    name: string | null
    category: string
}

// SearchResult with score for ranked results
export interface ScoredSearchResult extends SearchResult {
    score: number
}

// Sync state tracking
export interface SyncState {
    status: 'idle' | 'syncing' | 'complete'
    lastSyncTime?: number
    totalRows?: number
}

let syncState: SyncState = { status: 'idle' }
let fullDumpSyncEnabled = false

export function getSyncState(): SyncState {
    return syncState
}

export function setSyncState(state: SyncState) {
    syncState = state
}

// Fetch all search data using cursor-based pagination.
// Waits for the pre-computed index load attempt first so we can skip
// the expensive 57-page fetch when the Dexie index is available.
async function fetchAllSearches(): Promise<SearchResult[]> {
    if (!fullDumpSyncEnabled) {
        return []
    }

    // Gate: let the pre-computed index load finish before we decide.
    // Without this, the useLiveQuery subscription triggers this queryFn
    // before loadPrecomputedIndex has had time to read from Dexie.
    if (indexLoadPromise) {
        try { await indexLoadPromise } catch { /* fallback to full dump */ }
    }

    if (isSearchIndexReady()) {
        console.log('[SearchSync] Pre-computed index ready, skipping full-dump fetch')
        setSyncState({ status: 'complete', lastSyncTime: Date.now(), totalRows: 0 })
        return []
    }

    setSyncState({ status: 'syncing' })
    
    const allItems: SearchResult[] = []
    let cursor: string | null = null
    let pageCount = 0

    try {
        while (true) {
            const urlStr: string = cursor
                ? `/api/duckdb-search/full-dump?cursor=${cursor}&pageSize=1000`
                : '/api/duckdb-search/full-dump?pageSize=1000'

            const response: Response = await fetch(urlStr)
            if (!response.ok) throw new Error('Failed to fetch search page')

            const pageData: { items: SearchResult[]; nextCursor: string | null } = await response.json()
            
            if (pageData.items.length > 0) {
                allItems.push(...pageData.items)
                pageCount++
            }

            cursor = pageData.nextCursor
            if (!cursor) break
        }

        setSyncState({ status: 'complete', lastSyncTime: Date.now(), totalRows: allItems.length })
        console.log(`[SearchSync] Fetched ${pageCount} pages (${allItems.length} rows)`)
        return allItems
    } catch (error) {
        console.error('[SearchSync] Error:', error)
        setSyncState({ status: 'idle' })
        throw error
    }
}

// Factory function to create searches collection with a given QueryClient
// This allows using the shared queryClient with IndexedDB persistence
export function createSearchesCollection(queryClient: QueryClient) {
    return createCollection(
        queryCollectionOptions<SearchResult>({
            queryKey: ['searches'],
            queryFn: fetchAllSearches,
            queryClient,
            getKey: (item) => item.id,
            staleTime: Infinity, // Never auto-refetch
        })
    )
}

// Default export using shared queryClient (with IndexedDB persistence)
export const searchesCollection = createSearchesCollection(sharedQueryClient)

// Preload the searches collection - call this on app init
export async function preloadSearches(): Promise<void> {
    const state = getSyncState()
    if (state.status === 'complete') {
        console.log('[SearchSync] Already loaded, skipping preload')
        return
    }

    fullDumpSyncEnabled = true
    sharedQueryClient.removeQueries({ queryKey: ['searches'] })

    // Trigger the queryFn by accessing the collection
    await searchesCollection.preload()
}

// ============================================================
// HIGH-PERFORMANCE PREFIX INDEX FOR SUB-MILLISECOND SEARCH
// ============================================================

interface RuntimeSearchItem extends SearchResult {
    lowerCode: string
    lowerName: string
}

interface RuntimeSearchIndex {
    exactCode: Record<string, number[]>
    codeBuckets: Record<string, number[]>
    nameBuckets: Record<string, number[]>
    items: RuntimeSearchItem[]
    metadata?: CompactSearchIndexPayload['metadata']
}

let searchIndex: RuntimeSearchIndex | null = null
let indexLoadPromise: Promise<void> | null = null

export function createRuntimeSearchIndex(payload: CompactSearchIndexPayload): RuntimeSearchIndex {
    const items: RuntimeSearchItem[] = []
    const exactCode: Record<string, number[]> = Object.create(null)
    const codeBuckets: Record<string, number[]> = Object.create(null)
    const nameBuckets: Record<string, number[]> = Object.create(null)

    for (const tuple of payload.items) {
        const record = tupleToSearchIndexRecord(tuple)
        if (!record.code) continue

        const lowerCode = record.code.toLowerCase()
        const lowerName = (record.name || '').toLowerCase()
        const itemIndex = items.length

        items.push({
            ...record,
            lowerCode,
            lowerName,
        })

        if (!exactCode[lowerCode]) exactCode[lowerCode] = []
        exactCode[lowerCode].push(itemIndex)

        const codeBucket = lowerCode.slice(0, 2)
        if (codeBucket.length === 2) {
            if (!codeBuckets[codeBucket]) codeBuckets[codeBucket] = []
            codeBuckets[codeBucket].push(itemIndex)
        }

        const nameBucket = lowerName.slice(0, 2)
        if (nameBucket.length === 2) {
            if (!nameBuckets[nameBucket]) nameBuckets[nameBucket] = []
            nameBuckets[nameBucket].push(itemIndex)
        }
    }

    return {
        exactCode,
        codeBuckets,
        nameBuckets,
        items,
        metadata: payload.metadata,
    }
}

export function searchRuntimeIndex(
    index: RuntimeSearchIndex | null,
    query: string,
    limit: number = 20,
): ScoredSearchResult[] {
    if (!index || query.length < 2) return []

    const lowerQuery = query.toLowerCase()
    const results: Array<{ item: SearchResult; score: number }> = []
    const seenIndexes = new Set<number>()

    const pushResult = (itemIndex: number, score: number) => {
        if (seenIndexes.has(itemIndex)) return
        const item = index.items[itemIndex]
        if (!item) return
        seenIndexes.add(itemIndex)
        results.push({
            item: {
                id: item.id,
                cusip: item.cusip,
                code: item.code,
                name: item.name,
                category: item.category,
            },
            score,
        })
    }

    const exactMatches = index.exactCode[lowerQuery]
    if (exactMatches) {
        for (const itemIndex of exactMatches) {
            pushResult(itemIndex, 100)
        }
    }

    const bucketKey = lowerQuery.slice(0, 2)

    if (bucketKey.length === 2) {
        const codePrefixMatches = index.codeBuckets[bucketKey]
        if (codePrefixMatches) {
            for (const itemIndex of codePrefixMatches) {
                const item = index.items[itemIndex]
                if (item?.lowerCode.startsWith(lowerQuery)) {
                    pushResult(itemIndex, 80)
                }
            }
        }

        const namePrefixMatches = index.nameBuckets[bucketKey]
        if (namePrefixMatches) {
            for (const itemIndex of namePrefixMatches) {
                const item = index.items[itemIndex]
                if (item?.lowerName.startsWith(lowerQuery)) {
                    pushResult(itemIndex, 40)
                }
            }
        }
    }

    if (results.length < limit) {
        for (let itemIndex = 0; itemIndex < index.items.length; itemIndex += 1) {
            if (seenIndexes.has(itemIndex)) continue

            const item = index.items[itemIndex]
            if (!item) continue

            if (item.lowerCode.includes(lowerQuery) && !item.lowerCode.startsWith(lowerQuery)) {
                pushResult(itemIndex, 60)
                if (results.length >= limit * 2) break
                continue
            }

            if (item.lowerName.includes(lowerQuery) && !item.lowerName.startsWith(lowerQuery)) {
                pushResult(itemIndex, 20)
                if (results.length >= limit * 2) break
            }
        }
    }

    results.sort((a, b) => b.score - a.score || (a.item.name || '').localeCompare(b.item.name || ''))

    return results.slice(0, limit).map(r => ({ ...r.item, score: r.score } as ScoredSearchResult))
}

// Load pre-computed index - tries IndexedDB first, then fetches from API
export async function loadPrecomputedIndex(): Promise<void> {
    // Prevent multiple simultaneous loads
    if (indexLoadPromise) {
        return indexLoadPromise
    }
    
    if (searchIndex && searchIndex.items.length > 0) {
        console.log('[SearchIndex] Already loaded, skipping')
        return
    }
    
    indexLoadPromise = (async () => {
        const startTime = performance.now()
        
        try {
            // Try to load from IndexedDB first
            const persisted = await loadPersistedSearchIndex()
            if (persisted && persisted.items.length > 0) {
                searchIndex = createRuntimeSearchIndex(persisted)
                console.log(`[SearchIndex] Restored from IndexedDB in ${(performance.now() - startTime).toFixed(1)}ms (${persisted.metadata?.totalItems || 0} items)`)
                return
            }
            
            // Fetch from API if not in IndexedDB
            const fetchStart = performance.now()
            const response = await fetch('/api/duckdb-search/index')
            const fetchEnd = performance.now()

            if (!response.ok) {
                throw new Error(`Failed to load index: ${response.status}`)
            }

            const textStart = performance.now()
            const text = await response.text()
            const textEnd = performance.now()

            const parseStart = performance.now()
            const payload = compactSearchIndexPayload(JSON.parse(text))
            const parseEnd = performance.now()
            
            if (payload.metadata?.error) {
                console.warn('[SearchIndex] Index not available:', payload.metadata.error)
                searchIndex = null
                return
            }
            
            searchIndex = createRuntimeSearchIndex(payload)
            
            // Persist to IndexedDB for next time
            await persistSearchIndex(payload as PersistedSearchIndex)
            
            const total = parseEnd - startTime
            const network = fetchEnd - fetchStart
            const download = textEnd - textStart
            const parse = parseEnd - parseStart

            console.log(
                `[SearchIndex] Loaded pre-computed index: total=${total.toFixed(1)}ms ` +
                `(network=${network.toFixed(1)}ms, download=${download.toFixed(1)}ms, parse=${parse.toFixed(1)}ms, ` +
                `items=${payload.metadata?.totalItems || 0})`
            )
        } catch (error) {
            console.error('[SearchIndex] Failed to load:', error)
            searchIndex = null
        }
        // NOTE: we intentionally do NOT clear indexLoadPromise here.
        // fetchAllSearches awaits it to gate the expensive full-dump.
    })()
    
    return indexLoadPromise
}

// Build the search index from items (fallback if pre-computed index not available)
export function buildSearchIndex(items: SearchResult[]): void {
    if (searchIndex && searchIndex.items.length > 0) {
        console.log('[SearchIndex] Pre-computed index already loaded, skipping runtime build')
        return
    }
    
    const startTime = performance.now()
    searchIndex = createRuntimeSearchIndex({
        items: items.map(recordToSearchIndexTuple),
        metadata: { totalItems: items.length },
    })
    
    const elapsed = performance.now() - startTime
    console.log(`[SearchIndex] Built index at runtime for ${items.length} items in ${elapsed.toFixed(1)}ms`)
}

// Fast search using pre-computed index - O(1) lookup instead of O(n) filter
// Falls back to O(n) substring scan for matches not found by prefix indexing
export function searchWithIndex(query: string, limit: number = 20): ScoredSearchResult[] {
    return searchRuntimeIndex(searchIndex, query, limit)
}

// Check if index is ready
export function isSearchIndexReady(): boolean {
    return searchIndex !== null && searchIndex.items.length > 0
}
