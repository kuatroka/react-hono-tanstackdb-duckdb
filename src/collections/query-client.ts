/**
 * Shared QueryClient with Dexie IndexedDB Persistence
 *
 * This file creates the shared QueryClient instance with IndexedDB persistence
 * using Dexie for proper connection lifecycle management.
 *
 * Dexie provides:
 * - Proper connection lifecycle (close/delete/reopen without page reload)
 * - Single database with multiple tables
 * - Better error handling
 */

import { QueryClient } from '@tanstack/query-core'
import { experimental_createQueryPersister } from '@tanstack/query-persist-client-core'
import { createDexieStorage } from '@/lib/dexie-persister'
import {
    getDb,
    type SearchIndexEntry,
    type CikQuarterlyEntry,
    type DrilldownEntry,
    type AssetActivityEntry,
    type InvestorFlowEntry,
} from '@/lib/dexie-db'

// Create the persister using Dexie storage
// Each query is persisted separately (not the whole client)
// Queries are lazily restored when first used
export const persister = typeof window !== 'undefined'
    ? experimental_createQueryPersister({
        storage: createDexieStorage(),
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    })
    : null

// Shared QueryClient instance with Dexie persistence
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000,      // 5 minutes - refetch after this
            gcTime: 1000 * 60 * 30,        // 30 minutes in memory (persister handles long-term)
            persister: persister?.persisterFn,
        },
    },
})

// ============================================================
// SEARCH INDEX PERSISTENCE (using Dexie searchIndex table)
// ============================================================

const SEARCH_INDEX_KEY = 'search-index-v1'

export interface PersistedSearchIndex {
    codeExact: Record<string, number[]>
    codePrefixes: Record<string, number[]>
    namePrefixes: Record<string, number[]>
    items: Record<string, { id: number; cusip: string | null; code: string; name: string | null; category: string }>
    metadata?: {
        totalItems: number
        generatedAt?: string
        persistedAt?: number
    }
}

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
            codeExact: index.codeExact,
            codePrefixes: index.codePrefixes,
            namePrefixes: index.namePrefixes,
            items: index.items,
            metadata: {
                totalItems: index.metadata?.totalItems ?? 0,
                generatedAt: index.metadata?.generatedAt,
                persistedAt: Date.now(),
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

        const index: PersistedSearchIndex = {
            codeExact: entry.codeExact,
            codePrefixes: entry.codePrefixes,
            namePrefixes: entry.namePrefixes,
            items: entry.items,
            metadata: entry.metadata,
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
