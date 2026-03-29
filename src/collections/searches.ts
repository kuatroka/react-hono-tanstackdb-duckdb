import { createCollection } from '@tanstack/db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import { QueryClient } from '@tanstack/query-core'
import { 
    queryClient as sharedQueryClient, 
    loadPersistedSearchIndex, 
    persistSearchIndex,
    type PersistedSearchIndex 
} from './query-client'

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

// Pre-computed index structure for O(1) prefix lookups
interface SearchIndex {
    // Maps lowercase prefix -> array of item IDs (from JSON)
    codeExact: Record<string, number[]>
    codePrefixes: Record<string, number[]>
    namePrefixes: Record<string, number[]>
    // Maps ID -> item for fast retrieval
    items: Record<string, SearchResult>
    metadata?: {
        totalItems: number
        generatedAt?: string
        error?: string
    }
}

let searchIndex: SearchIndex | null = null
let indexLoadPromise: Promise<void> | null = null

// Load pre-computed index - tries IndexedDB first, then fetches from API
export async function loadPrecomputedIndex(): Promise<void> {
    // Prevent multiple simultaneous loads
    if (indexLoadPromise) {
        return indexLoadPromise
    }
    
    if (searchIndex && Object.keys(searchIndex.items).length > 0) {
        console.log('[SearchIndex] Already loaded, skipping')
        return
    }
    
    indexLoadPromise = (async () => {
        const startTime = performance.now()
        
        try {
            // Try to load from IndexedDB first
            const persisted = await loadPersistedSearchIndex()
            if (persisted && Object.keys(persisted.items).length > 0) {
                searchIndex = persisted as SearchIndex
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
            const data: SearchIndex = JSON.parse(text)
            const parseEnd = performance.now()
            
            if (data.metadata?.error) {
                console.warn('[SearchIndex] Index not available:', data.metadata.error)
                searchIndex = null
                return
            }
            
            searchIndex = data
            
            // Persist to IndexedDB for next time
            await persistSearchIndex(data as PersistedSearchIndex)
            
            const total = parseEnd - startTime
            const network = fetchEnd - fetchStart
            const download = textEnd - textStart
            const parse = parseEnd - parseStart

            console.log(
                `[SearchIndex] Loaded pre-computed index: total=${total.toFixed(1)}ms ` +
                `(network=${network.toFixed(1)}ms, download=${download.toFixed(1)}ms, parse=${parse.toFixed(1)}ms, ` +
                `items=${data.metadata?.totalItems || 0})`
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
    if (searchIndex && Object.keys(searchIndex.items).length > 0) {
        console.log('[SearchIndex] Pre-computed index already loaded, skipping runtime build')
        return
    }
    
    const startTime = performance.now()
    
    const codeExact: Record<string, number[]> = {}
    const codePrefixes: Record<string, number[]> = {}
    const namePrefixes: Record<string, number[]> = {}
    const itemsMap: Record<string, SearchResult> = {}
    
    for (const item of items) {
        if (!item || !item.code) continue
        
        itemsMap[item.id] = item
        const lowerCode = item.code.toLowerCase()
        const lowerName = (item.name || '').toLowerCase()
        
        // Index exact code
        if (!codeExact[lowerCode]) codeExact[lowerCode] = []
        codeExact[lowerCode].push(item.id)
        
        // Index code prefixes (up to 10 chars)
        for (let i = 1; i <= Math.min(lowerCode.length, 10); i++) {
            const prefix = lowerCode.slice(0, i)
            if (!codePrefixes[prefix]) codePrefixes[prefix] = []
            codePrefixes[prefix].push(item.id)
        }
        
        // Index name prefixes (up to 10 chars)
        if (lowerName) {
            for (let i = 1; i <= Math.min(lowerName.length, 10); i++) {
                const prefix = lowerName.slice(0, i)
                if (!namePrefixes[prefix]) namePrefixes[prefix] = []
                namePrefixes[prefix].push(item.id)
            }
        }
    }
    
    searchIndex = { 
        codeExact, 
        codePrefixes, 
        namePrefixes, 
        items: itemsMap,
        metadata: { totalItems: items.length }
    }
    
    const elapsed = performance.now() - startTime
    console.log(`[SearchIndex] Built index at runtime for ${items.length} items in ${elapsed.toFixed(1)}ms`)
}

// Fast search using pre-computed index - O(1) lookup instead of O(n) filter
// Falls back to O(n) substring scan for matches not found by prefix indexing
export function searchWithIndex(query: string, limit: number = 20): ScoredSearchResult[] {
    if (!searchIndex || query.length < 2) return []

    const lowerQuery = query.toLowerCase()
    const results: Array<{ item: SearchResult; score: number }> = []
    const seenIds = new Set<number>()

    // 1. Exact code match (score: 100)
    const exactMatches = searchIndex.codeExact[lowerQuery]
    if (exactMatches) {
        for (const id of exactMatches) {
            if (seenIds.has(id)) continue
            seenIds.add(id)
            const item = searchIndex.items[id]
            if (item) results.push({ item, score: 100 })
        }
    }

    // 2. Code prefix match (score: 80)
    const codePrefixMatches = searchIndex.codePrefixes[lowerQuery]
    if (codePrefixMatches) {
        for (const id of codePrefixMatches) {
            if (seenIds.has(id)) continue
            seenIds.add(id)
            const item = searchIndex.items[id]
            if (item) results.push({ item, score: 80 })
        }
    }

    // 3. Name prefix match (score: 40)
    const namePrefixMatches = searchIndex.namePrefixes[lowerQuery]
    if (namePrefixMatches) {
        for (const id of namePrefixMatches) {
            if (seenIds.has(id)) continue
            seenIds.add(id)
            const item = searchIndex.items[id]
            if (item) results.push({ item, score: 40 })
        }
    }

    // 4. Substring matches - O(n) scan for "contains" matches not found by prefix
    // This handles cases like searching "disney" to find "Walt Disney"
    // Only scan if we haven't found enough results from prefix matching
    if (results.length < limit) {
        for (const id of Object.keys(searchIndex.items)) {
            const numId = Number(id)
            if (seenIds.has(numId)) continue

            const item = searchIndex.items[id]
            if (!item) continue

            const lowerCode = item.code.toLowerCase()
            const lowerName = (item.name || '').toLowerCase()

            // Check for code substring (not prefix, since prefix already checked)
            if (lowerCode.includes(lowerQuery) && !lowerCode.startsWith(lowerQuery)) {
                seenIds.add(numId)
                results.push({ item, score: 60 })
                if (results.length >= limit * 2) break // Limit scan scope
                continue
            }

            // Check for name substring (not prefix, since prefix already checked)
            if (lowerName.includes(lowerQuery) && !lowerName.startsWith(lowerQuery)) {
                seenIds.add(numId)
                results.push({ item, score: 20 })
                if (results.length >= limit * 2) break // Limit scan scope
            }
        }
    }

    // Sort by score and limit
    results.sort((a, b) => b.score - a.score || (a.item.name || '').localeCompare(b.item.name || ''))

    return results.slice(0, limit).map(r => ({ ...r.item, score: r.score } as ScoredSearchResult))
}

// Check if index is ready
export function isSearchIndexReady(): boolean {
    return searchIndex !== null && Object.keys(searchIndex.items).length > 0
}
