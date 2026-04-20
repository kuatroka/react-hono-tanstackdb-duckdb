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
    type CompactSearchIndexPayload,
} from '@/lib/search-index'

export interface SearchResult {
    id: number
    cusip: string | null
    code: string
    name: string | null
    category: string
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

export async function ensureSearchItemsLoaded(): Promise<SearchResult[]> {
    if (loadedSearchItems.length > 0) {
        return loadedSearchItems
    }

    await loadPrecomputedIndex()
    if (loadedSearchItems.length > 0) {
        return loadedSearchItems
    }

    const state = getSyncState()
    if (state.status !== 'complete') {
        await preloadSearches()
    }

    loadedSearchItems = Array.from(searchesCollection.entries()).map(([, value]) => value as unknown as SearchResult)
    return loadedSearchItems
}
let indexLoadPromise: Promise<void> | null = null
let loadedSearchItems: SearchResult[] = []
let searchIndexMetadata: CompactSearchIndexPayload['metadata'] | undefined

export function decodeSearchIndexItems(payload: CompactSearchIndexPayload): SearchResult[] {
    return payload.items.map(tupleToSearchIndexRecord)
}

// Load pre-computed index - tries IndexedDB first, then fetches from API
export async function loadPrecomputedIndex(): Promise<void> {
    // Prevent multiple simultaneous loads
    if (indexLoadPromise) {
        return indexLoadPromise
    }
    
    if (loadedSearchItems.length > 0) {
        console.log('[SearchIndex] Already loaded, skipping')
        return
    }
    
    indexLoadPromise = (async () => {
        const startTime = performance.now()
        
        try {
            // Try to load from IndexedDB first
            const persisted = await loadPersistedSearchIndex()
            if (persisted && persisted.items.length > 0) {
                searchIndexMetadata = persisted.metadata
                loadedSearchItems = decodeSearchIndexItems(persisted)
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
                searchIndexMetadata = payload.metadata
                return
            }
            
            searchIndexMetadata = payload.metadata
            loadedSearchItems = decodeSearchIndexItems(payload)
            
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
            searchIndexMetadata = undefined
        }
        // NOTE: we intentionally do NOT clear indexLoadPromise here.
        // fetchAllSearches awaits it to gate the expensive full-dump.
    })()
    
    return indexLoadPromise
}

export function getLoadedSearchItems(): SearchResult[] {
    return loadedSearchItems
}

export function getSearchIndexMetadata(): CompactSearchIndexPayload['metadata'] | undefined {
    return searchIndexMetadata
}

export function isSearchIndexReady(): boolean {
    return loadedSearchItems.length > 0
}
