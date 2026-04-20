/**
 * Shared QueryClient (no query-level persister)
 *
 * Large collections (assets 40K, searches 56K, superinvestors 15K) fetch
 * fresh from the fast DuckDB API on each page load (~60 ms).
 *
 * Route-specific data (search index, asset-activity, investor-flow,
 * drilldown, cik-quarterly) is persisted manually in dedicated Dexie
 * tables – see the individual collection modules.
 *
 * Removing the per-query persister eliminates the "restore-then-refetch"
 * double-load that caused peak heap to grow on every refresh.
 */

import { QueryClient } from '@tanstack/query-core'
import {
    getDb,
    type SearchIndexEntry,
    type CikQuarterlyEntry,
    type DrilldownEntry,
    type AssetActivityEntry,
    type InvestorFlowEntry,
    type AssetListEntry,
    type SuperinvestorListEntry,
} from '@/lib/dexie-db'
import {
    compactSearchIndexPayload,
    type CompactSearchIndexPayload,
} from '@/lib/search-index'

// Shared QueryClient – no per-query persister
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000,      // 5 minutes
            gcTime: 1000 * 60 * 30,         // 30 minutes in memory
        },
    },
})

/**
 * One-time cleanup: drop any data left in the legacy queryCache table
 * so it doesn't bloat IndexedDB (~11 MB for the four persisted queries).
 */
export async function clearLegacyQueryCache(): Promise<void> {
    if (typeof window === 'undefined') return
    try {
        const db = getDb()
        const count = await db.queryCache.count()
        if (count > 0) {
            await db.queryCache.clear()
            console.log(`[QueryClient] Cleared ${count} legacy queryCache entries`)
        }
    } catch {
        // Table may not exist in fresh installs – ignore
    }
}

// ============================================================
// SEARCH INDEX PERSISTENCE (using Dexie searchIndex table)
// ============================================================

const SEARCH_INDEX_KEY = 'search-index-v1'

export type PersistedSearchIndex = CompactSearchIndexPayload

/**
 * Save search index to IndexedDB via Dexie
 */
export async function persistSearchIndex(index: PersistedSearchIndex): Promise<void> {
    if (typeof window === 'undefined') return

    try {
        const startTime = performance.now()
        const db = getDb()
        const entry: SearchIndexEntry = {
            key: SEARCH_INDEX_KEY,
            items: index.items,
            metadata: {
                totalItems: index.metadata?.totalItems ?? 0,
                generatedAt: index.metadata?.generatedAt,
                persistedAt: Date.now(),
                indexFileBytes: index.metadata?.indexFileBytes,
                compactBytes: index.metadata?.compactBytes,
            },
        }
        await db.searchIndex.put(entry)
        console.log(`[SearchIndex] Persisted to IndexedDB in ${(performance.now() - startTime).toFixed(1)}ms`)
    } catch (error) {
        console.error('[SearchIndex] Failed to persist:', error)
    }
}

/**
 * Load search index from IndexedDB via Dexie
 * Returns null if not found or expired (older than 7 days)
 */
export async function loadPersistedSearchIndex(): Promise<PersistedSearchIndex | null> {
    if (typeof window === 'undefined') return null

    try {
        const startTime = performance.now()
        const db = getDb()
        const entry = await db.searchIndex.get(SEARCH_INDEX_KEY)

        if (!entry) {
            console.log('[SearchIndex] No persisted index found')
            return null
        }

        // Check if expired (7 days)
        const persistedAt = entry.metadata?.persistedAt
        if (persistedAt) {
            const age = Date.now() - persistedAt
            const maxAge = 1000 * 60 * 60 * 24 * 7 // 7 days
            if (age > maxAge) {
                console.log('[SearchIndex] Persisted index expired, will refetch')
                await db.searchIndex.delete(SEARCH_INDEX_KEY)
                return null
            }
        }

        const index = compactSearchIndexPayload({
            codeExact: entry.codeExact,
            codePrefixes: entry.codePrefixes,
            namePrefixes: entry.namePrefixes,
            items: entry.items,
            metadata: entry.metadata,
        })

        if (!Array.isArray(entry.items)) {
            void db.searchIndex.put({
                key: SEARCH_INDEX_KEY,
                items: index.items,
                metadata: {
                    totalItems: index.metadata?.totalItems ?? index.items.length,
                    generatedAt: index.metadata?.generatedAt,
                    persistedAt: entry.metadata?.persistedAt ?? Date.now(),
                    indexFileBytes: index.metadata?.indexFileBytes,
                    compactBytes: index.metadata?.compactBytes,
                },
            })
        }

        console.log(`[SearchIndex] Loaded from IndexedDB in ${(performance.now() - startTime).toFixed(1)}ms (${entry.metadata?.totalItems || 0} items)`)
        return index
    } catch (error) {
        console.error('[SearchIndex] Failed to load from IndexedDB:', error)
        return null
    }
}

/**
 * Clear persisted search index
 */
export async function clearPersistedSearchIndex(): Promise<void> {
    if (typeof window === 'undefined') return

    try {
        const db = getDb()
        await db.searchIndex.delete(SEARCH_INDEX_KEY)
        console.log('[SearchIndex] Cleared from IndexedDB')
    } catch (error) {
        console.error('[SearchIndex] Failed to clear:', error)
    }
}

// ============================================================
// CIK QUARTERLY DATA PERSISTENCE (using Dexie cikQuarterly table)
// ============================================================

export interface PersistedCikQuarterlyData {
    cik: string
    rows: Array<{
        id: string
        cik: string
        quarter: string
        quarterEndDate: string
        totalValue: number
        totalValuePrcChg: number | null
        numAssets: number
    }>
    metadata?: {
        persistedAt?: number
    }
}

/**
 * Save CIK quarterly data to IndexedDB via Dexie
 */
export async function persistCikQuarterlyData(cik: string, rows: PersistedCikQuarterlyData['rows']): Promise<void> {
    if (typeof window === 'undefined') return

    try {
        const startTime = performance.now()
        const db = getDb()
        const entry: CikQuarterlyEntry = {
            cik,
            rows,
            persistedAt: Date.now(),
        }
        await db.cikQuarterly.put(entry)
        console.log(`[CikQuarterly] Persisted ${rows.length} quarters for CIK ${cik} to IndexedDB in ${(performance.now() - startTime).toFixed(1)}ms`)
    } catch (error) {
        console.error('[CikQuarterly] Failed to persist:', error)
    }
}

/**
 * Load CIK quarterly data from IndexedDB via Dexie
 * Returns null if not found or expired (older than 7 days)
 */
export async function loadPersistedCikQuarterlyData(cik: string): Promise<PersistedCikQuarterlyData | null> {
    if (typeof window === 'undefined') return null

    try {
        const startTime = performance.now()
        const db = getDb()
        const entry = await db.cikQuarterly.get(cik)

        if (!entry) {
            return null
        }

        // Check if expired (7 days)
        const persistedAt = entry.persistedAt
        if (persistedAt) {
            const age = Date.now() - persistedAt
            const maxAge = 1000 * 60 * 60 * 24 * 7 // 7 days
            if (age > maxAge) {
                console.log(`[CikQuarterly] Persisted data for CIK ${cik} expired, will refetch`)
                await db.cikQuarterly.delete(cik)
                return null
            }
        }

        const data: PersistedCikQuarterlyData = {
            cik: entry.cik,
            rows: entry.rows,
            metadata: {
                persistedAt: entry.persistedAt,
            },
        }

        console.log(`[CikQuarterly] Loaded ${entry.rows.length} quarters for CIK ${cik} from IndexedDB in ${(performance.now() - startTime).toFixed(1)}ms`)
        return data
    } catch (error) {
        console.error('[CikQuarterly] Failed to load from IndexedDB:', error)
        return null
    }
}

/**
 * Clear persisted CIK quarterly data for a specific CIK
 */
export async function clearPersistedCikQuarterlyData(cik: string): Promise<void> {
    if (typeof window === 'undefined') return

    try {
        const db = getDb()
        await db.cikQuarterly.delete(cik)
        console.log(`[CikQuarterly] Cleared data for CIK ${cik} from IndexedDB`)
    } catch (error) {
        console.error('[CikQuarterly] Failed to clear:', error)
    }
}

// ============================================================
// DRILLDOWN DATA PERSISTENCE (using Dexie drilldown table)
// ============================================================

const DRILLDOWN_KEY = 'investor-drilldown-v1'

export interface PersistedDrilldownData {
    rows: Array<{
        id: string
        ticker: string
        cik: string
        cikName: string
        cikTicker: string
        quarter: string
        cusip: string | null
        action: 'open' | 'close'
        didOpen: boolean | null
        didAdd: boolean | null
        didReduce: boolean | null
        didClose: boolean | null
        didHold: boolean | null
    }>
    fetchedCombinations: string[]
    bulkFetchedPairs: string[]
    metadata?: {
        totalRows: number
        persistedAt?: number
    }
}

/**
 * Save drilldown data to IndexedDB via Dexie
 */
export async function persistDrilldownData(data: PersistedDrilldownData): Promise<void> {
    if (typeof window === 'undefined') return

    try {
        const startTime = performance.now()
        const db = getDb()
        const entry: DrilldownEntry = {
            key: DRILLDOWN_KEY,
            rows: data.rows,
            fetchedCombinations: data.fetchedCombinations,
            bulkFetchedPairs: data.bulkFetchedPairs,
            metadata: {
                totalRows: data.rows.length,
                persistedAt: Date.now(),
            },
        }
        await db.drilldown.put(entry)
        console.log(`[Drilldown] Persisted ${data.rows.length} rows to IndexedDB in ${(performance.now() - startTime).toFixed(1)}ms`)
    } catch (error) {
        console.error('[Drilldown] Failed to persist:', error)
    }
}

/**
 * Load drilldown data from IndexedDB via Dexie
 * Returns null if not found or expired (older than 1 day)
 */
export async function loadPersistedDrilldownData(): Promise<PersistedDrilldownData | null> {
    if (typeof window === 'undefined') return null

    try {
        const startTime = performance.now()
        const db = getDb()
        const entry = await db.drilldown.get(DRILLDOWN_KEY)

        if (!entry) {
            console.log('[Drilldown] No persisted data found')
            return null
        }

        // Check if expired (1 day for drilldown data - it changes more frequently)
        const persistedAt = entry.metadata?.persistedAt
        if (persistedAt) {
            const age = Date.now() - persistedAt
            const maxAge = 1000 * 60 * 60 * 24 // 1 day
            if (age > maxAge) {
                console.log('[Drilldown] Persisted data expired, will refetch')
                await db.drilldown.delete(DRILLDOWN_KEY)
                return null
            }
        }

        const data: PersistedDrilldownData = {
            rows: entry.rows,
            fetchedCombinations: entry.fetchedCombinations,
            bulkFetchedPairs: entry.bulkFetchedPairs,
            metadata: entry.metadata,
        }

        console.log(`[Drilldown] Loaded ${entry.rows.length} rows from IndexedDB in ${(performance.now() - startTime).toFixed(1)}ms`)
        return data
    } catch (error) {
        console.error('[Drilldown] Failed to load from IndexedDB:', error)
        return null
    }
}

/**
 * Clear persisted drilldown data
 */
export async function clearPersistedDrilldownData(): Promise<void> {
    if (typeof window === 'undefined') return

    try {
        const db = getDb()
        await db.drilldown.delete(DRILLDOWN_KEY)
        console.log('[Drilldown] Cleared from IndexedDB')
    } catch (error) {
        console.error('[Drilldown] Failed to clear:', error)
    }
}

// ============================================================
// ASSET ACTIVITY PERSISTENCE (using Dexie assetActivity table)
// ============================================================

export interface PersistedAssetActivityData {
    key: string
    rows: Array<{
        id: string
        assetKey: string
        ticker: string
        cusip: string | null
        quarter: string
        numOpen: number
        numAdd: number
        numReduce: number
        numClose: number
        numHold: number
        opened: number
        closed: number
    }>
    metadata?: {
        persistedAt?: number
    }
}

export async function persistAssetActivityData(key: string, rows: PersistedAssetActivityData['rows']): Promise<void> {
    if (typeof window === 'undefined') return

    try {
        const startTime = performance.now()
        const db = getDb()
        const entry: AssetActivityEntry = {
            key,
            rows,
            persistedAt: Date.now(),
        }
        await db.assetActivity.put(entry)
        console.log(`[AssetActivity] Persisted ${rows.length} rows for ${key} to IndexedDB in ${(performance.now() - startTime).toFixed(1)}ms`)
    } catch (error) {
        console.error('[AssetActivity] Failed to persist:', error)
    }
}

export async function loadPersistedAssetActivityData(key: string): Promise<PersistedAssetActivityData | null> {
    if (typeof window === 'undefined') return null

    try {
        const startTime = performance.now()
        const db = getDb()
        const entry = await db.assetActivity.get(key)

        if (!entry) {
            return null
        }

        const age = Date.now() - entry.persistedAt
        const maxAge = 1000 * 60 * 60 * 24
        if (age > maxAge) {
            await db.assetActivity.delete(key)
            return null
        }

        console.log(`[AssetActivity] Loaded ${entry.rows.length} rows for ${key} from IndexedDB in ${(performance.now() - startTime).toFixed(1)}ms`)
        return {
            key: entry.key,
            rows: entry.rows,
            metadata: {
                persistedAt: entry.persistedAt,
            },
        }
    } catch (error) {
        console.error('[AssetActivity] Failed to load from IndexedDB:', error)
        return null
    }
}

export async function clearPersistedAssetActivityData(key: string): Promise<void> {
    if (typeof window === 'undefined') return

    try {
        const db = getDb()
        await db.assetActivity.delete(key)
    } catch (error) {
        console.error('[AssetActivity] Failed to clear:', error)
    }
}

// ============================================================
// INVESTOR FLOW PERSISTENCE (using Dexie investorFlow table)
// ============================================================

export interface PersistedInvestorFlowData {
    ticker: string
    rows: Array<{
        id: string
        ticker: string
        quarter: string
        inflow: number
        outflow: number
    }>
    metadata?: {
        persistedAt?: number
    }
}

export async function persistInvestorFlowData(ticker: string, rows: PersistedInvestorFlowData['rows']): Promise<void> {
    if (typeof window === 'undefined') return

    try {
        const startTime = performance.now()
        const db = getDb()
        const entry: InvestorFlowEntry = {
            ticker,
            rows,
            persistedAt: Date.now(),
        }
        await db.investorFlow.put(entry)
        console.log(`[InvestorFlow] Persisted ${rows.length} rows for ${ticker} to IndexedDB in ${(performance.now() - startTime).toFixed(1)}ms`)
    } catch (error) {
        console.error('[InvestorFlow] Failed to persist:', error)
    }
}

export async function loadPersistedInvestorFlowData(ticker: string): Promise<PersistedInvestorFlowData | null> {
    if (typeof window === 'undefined') return null

    try {
        const startTime = performance.now()
        const db = getDb()
        const entry = await db.investorFlow.get(ticker)

        if (!entry) {
            return null
        }

        const age = Date.now() - entry.persistedAt
        const maxAge = 1000 * 60 * 60 * 24
        if (age > maxAge) {
            await db.investorFlow.delete(ticker)
            return null
        }

        console.log(`[InvestorFlow] Loaded ${entry.rows.length} rows for ${ticker} from IndexedDB in ${(performance.now() - startTime).toFixed(1)}ms`)
        return {
            ticker: entry.ticker,
            rows: entry.rows,
            metadata: {
                persistedAt: entry.persistedAt,
            },
        }
    } catch (error) {
        console.error('[InvestorFlow] Failed to load from IndexedDB:', error)
        return null
    }
}

export async function clearPersistedInvestorFlowData(ticker: string): Promise<void> {
    if (typeof window === 'undefined') return

    try {
        const db = getDb()
        await db.investorFlow.delete(ticker)
    } catch (error) {
        console.error('[InvestorFlow] Failed to clear:', error)
    }
}

// ============================================================
// ASSET LIST PERSISTENCE (using Dexie assetList table)
// ============================================================

const ASSET_LIST_KEY = 'assets-v1'
const SUPERINVESTOR_LIST_KEY = 'superinvestors-v1'
const LIST_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24

export interface PersistedAssetListData {
    key: string
    rows: Array<{
        id: string
        asset: string
        assetName: string
        cusip: string | null
    }>
    metadata?: {
        persistedAt?: number
    }
}

export interface PersistedSuperinvestorListData {
    key: string
    rows: Array<{
        id: string
        cik: string
        cikName: string
    }>
    metadata?: {
        persistedAt?: number
    }
}

export async function persistAssetListData(rows: PersistedAssetListData['rows']): Promise<void> {
    if (typeof window === 'undefined') return

    try {
        const startTime = performance.now()
        const db = getDb()
        const entry: AssetListEntry = {
            key: ASSET_LIST_KEY,
            rows,
            persistedAt: Date.now(),
        }
        await db.assetList.put(entry)
        console.log(`[Assets] Persisted ${rows.length} rows to IndexedDB in ${(performance.now() - startTime).toFixed(1)}ms`)
    } catch (error) {
        console.error('[Assets] Failed to persist list:', error)
    }
}

export async function loadPersistedAssetListData(): Promise<PersistedAssetListData | null> {
    if (typeof window === 'undefined') return null

    try {
        const startTime = performance.now()
        const db = getDb()
        const entry = await db.assetList.get(ASSET_LIST_KEY)

        if (!entry) {
            return null
        }

        const age = Date.now() - entry.persistedAt
        if (age > LIST_CACHE_MAX_AGE_MS) {
            await db.assetList.delete(ASSET_LIST_KEY)
            return null
        }

        console.log(`[Assets] Loaded ${entry.rows.length} rows from IndexedDB in ${(performance.now() - startTime).toFixed(1)}ms`)
        return {
            key: entry.key,
            rows: entry.rows,
            metadata: { persistedAt: entry.persistedAt },
        }
    } catch (error) {
        console.error('[Assets] Failed to load list from IndexedDB:', error)
        return null
    }
}

export async function persistSuperinvestorListData(rows: PersistedSuperinvestorListData['rows']): Promise<void> {
    if (typeof window === 'undefined') return

    try {
        const startTime = performance.now()
        const db = getDb()
        const entry: SuperinvestorListEntry = {
            key: SUPERINVESTOR_LIST_KEY,
            rows,
            persistedAt: Date.now(),
        }
        await db.superinvestorList.put(entry)
        console.log(`[Superinvestors] Persisted ${rows.length} rows to IndexedDB in ${(performance.now() - startTime).toFixed(1)}ms`)
    } catch (error) {
        console.error('[Superinvestors] Failed to persist list:', error)
    }
}

export async function loadPersistedSuperinvestorListData(): Promise<PersistedSuperinvestorListData | null> {
    if (typeof window === 'undefined') return null

    try {
        const startTime = performance.now()
        const db = getDb()
        const entry = await db.superinvestorList.get(SUPERINVESTOR_LIST_KEY)

        if (!entry) {
            return null
        }

        const age = Date.now() - entry.persistedAt
        if (age > LIST_CACHE_MAX_AGE_MS) {
            await db.superinvestorList.delete(SUPERINVESTOR_LIST_KEY)
            return null
        }

        console.log(`[Superinvestors] Loaded ${entry.rows.length} rows from IndexedDB in ${(performance.now() - startTime).toFixed(1)}ms`)
        return {
            key: entry.key,
            rows: entry.rows,
            metadata: { persistedAt: entry.persistedAt },
        }
    } catch (error) {
        console.error('[Superinvestors] Failed to load list from IndexedDB:', error)
        return null
    }
}
