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
import { getStoredDataVersion } from '@/lib/data-version'

function getCurrentDataVersion(): string | null {
    return getStoredDataVersion()
}

function hasExpiredPersistedAt(persistedAt: number | undefined, maxAgeMs: number): boolean {
    if (!persistedAt) {
        return false
    }
    return Date.now() - persistedAt > maxAgeMs
}

function isEntryForCurrentDataVersion(entryDataVersion: string | null | undefined): boolean {
    const currentDataVersion = getCurrentDataVersion()
    if (!currentDataVersion) {
        return true
    }
    return entryDataVersion === currentDataVersion
}

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

const SEARCH_INDEX_CACHE_ID = 'search-index-v2'

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
            key: SEARCH_INDEX_CACHE_ID,
            items: index.items,
            metadata: {
                totalItems: index.metadata?.totalItems ?? 0,
                generatedAt: index.metadata?.generatedAt,
                persistedAt: Date.now(),
                dataVersion: index.metadata?.dataVersion ?? getCurrentDataVersion(),
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
        const entry = await db.searchIndex.get(SEARCH_INDEX_CACHE_ID)

        if (!entry) {
            console.log('[SearchIndex] No persisted index found')
            return null
        }

        if (!isEntryForCurrentDataVersion(entry.metadata?.dataVersion)) {
            console.log('[SearchIndex] Persisted index is for an older data version, will refetch')
            await db.searchIndex.delete(SEARCH_INDEX_CACHE_ID)
            return null
        }

        const persistedAt = entry.metadata?.persistedAt
        const maxAge = 1000 * 60 * 60 * 24 * 7 // 7 days
        if (hasExpiredPersistedAt(persistedAt, maxAge)) {
            console.log('[SearchIndex] Persisted index expired, will refetch')
            await db.searchIndex.delete(SEARCH_INDEX_CACHE_ID)
            return null
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
                key: SEARCH_INDEX_CACHE_ID,
                items: index.items,
                metadata: {
                    totalItems: index.metadata?.totalItems ?? index.items.length,
                    generatedAt: index.metadata?.generatedAt,
                    persistedAt: entry.metadata?.persistedAt ?? Date.now(),
                    dataVersion: entry.metadata?.dataVersion ?? getCurrentDataVersion(),
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
        await db.searchIndex.delete(SEARCH_INDEX_CACHE_ID)
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
        dataVersion?: string | null
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
            dataVersion: getCurrentDataVersion(),
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

        if (!isEntryForCurrentDataVersion(entry.dataVersion)) {
            console.log(`[CikQuarterly] Persisted data for CIK ${cik} is for an older data version, will refetch`)
            await db.cikQuarterly.delete(cik)
            return null
        }

        const persistedAt = entry.persistedAt
        const maxAge = 1000 * 60 * 60 * 24 * 7 // 7 days
        if (hasExpiredPersistedAt(persistedAt, maxAge)) {
            console.log(`[CikQuarterly] Persisted data for CIK ${cik} expired, will refetch`)
            await db.cikQuarterly.delete(cik)
            return null
        }

        const data: PersistedCikQuarterlyData = {
            cik: entry.cik,
            rows: entry.rows,
            metadata: {
                persistedAt: entry.persistedAt,
                dataVersion: entry.dataVersion ?? null,
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

const DRILLDOWN_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24
const DRILLDOWN_MAX_PERSISTED_ROWS = 2000
const DRILLDOWN_MAX_PERSISTED_SCOPES = 12

export interface PersistedDrilldownData {
    key: string
    scope: 'quarter' | 'pair'
    pairKey: string
    quarter: string | null
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
    complete: boolean
    metadata?: {
        persistedAt?: number
        lastAccessedAt?: number
        dataVersion?: string | null
    }
}

function makePersistedDrilldownPairKey(pairKey: string): string {
    return `pair:${pairKey}`
}

function makePersistedDrilldownQuarterKey(pairKey: string, quarter: string): string {
    return `quarter:${pairKey}:${quarter}`
}

async function prunePersistedDrilldownData(db = getDb()): Promise<void> {
    const entries = await db.drilldown.orderBy('lastAccessedAt').toArray()
    const quarterEntries = entries.filter((entry) => entry.scope === 'quarter')
    const pairEntries = entries.filter((entry) => entry.scope === 'pair')
    const deleteKeys = [
        ...quarterEntries.slice(0, Math.max(quarterEntries.length - DRILLDOWN_MAX_PERSISTED_SCOPES, 0)).map((entry) => entry.key),
        ...pairEntries.slice(0, Math.max(pairEntries.length - DRILLDOWN_MAX_PERSISTED_SCOPES, 0)).map((entry) => entry.key),
    ]

    if (deleteKeys.length > 0) {
        await db.drilldown.bulkDelete(deleteKeys)
    }
}

function toPersistedDrilldownData(entry: DrilldownEntry): PersistedDrilldownData {
    return {
        key: entry.key,
        scope: entry.scope,
        pairKey: entry.pairKey,
        quarter: entry.quarter,
        rows: entry.rows,
        complete: entry.complete,
        metadata: {
            persistedAt: entry.persistedAt,
            lastAccessedAt: entry.lastAccessedAt,
            dataVersion: entry.dataVersion ?? null,
        },
    }
}

/**
 * Save scoped drilldown data to IndexedDB via Dexie
 */
export async function persistDrilldownData(data: PersistedDrilldownData): Promise<void> {
    if (typeof window === 'undefined') return

    try {
        const startTime = performance.now()
        const now = Date.now()
        const db = getDb()
        const rows = data.rows.length <= DRILLDOWN_MAX_PERSISTED_ROWS
            ? data.rows
            : data.rows.slice(0, DRILLDOWN_MAX_PERSISTED_ROWS)
        const entry: DrilldownEntry = {
            key: data.key,
            scope: data.scope,
            pairKey: data.pairKey,
            quarter: data.quarter,
            rows,
            complete: data.complete && rows.length === data.rows.length,
            persistedAt: now,
            lastAccessedAt: now,
            dataVersion: data.metadata?.dataVersion ?? getCurrentDataVersion(),
        }
        await db.drilldown.put(entry)
        await prunePersistedDrilldownData(db)
        console.log(`[Drilldown] Persisted ${rows.length} rows for ${data.key} in ${(performance.now() - startTime).toFixed(1)}ms`)
    } catch (error) {
        console.error('[Drilldown] Failed to persist:', error)
    }
}

/**
 * Load scoped drilldown data from IndexedDB via Dexie.
 * Returns null if not found or expired (older than 1 day).
 */
export async function loadPersistedDrilldownData(key: string): Promise<PersistedDrilldownData | null> {
    if (typeof window === 'undefined') return null

    try {
        const startTime = performance.now()
        const db = getDb()
        const entry = await db.drilldown.get(key)

        if (!entry) {
            return null
        }

        if (!isEntryForCurrentDataVersion(entry.dataVersion)) {
            await db.drilldown.delete(key)
            return null
        }

        if (hasExpiredPersistedAt(entry.persistedAt, DRILLDOWN_CACHE_MAX_AGE_MS)) {
            await db.drilldown.delete(key)
            return null
        }

        const lastAccessedAt = Date.now()
        void db.drilldown.update(key, { lastAccessedAt })

        console.log(`[Drilldown] Loaded ${entry.rows.length} rows for ${key} from IndexedDB in ${(performance.now() - startTime).toFixed(1)}ms`)
        return toPersistedDrilldownData({
            ...entry,
            lastAccessedAt,
        })
    } catch (error) {
        console.error('[Drilldown] Failed to load from IndexedDB:', error)
        return null
    }
}

export async function loadPersistedDrilldownPairData(pairKey: string): Promise<PersistedDrilldownData | null> {
    return loadPersistedDrilldownData(makePersistedDrilldownPairKey(pairKey))
}

export async function loadPersistedDrilldownQuarterData(pairKey: string, quarter: string): Promise<PersistedDrilldownData | null> {
    return loadPersistedDrilldownData(makePersistedDrilldownQuarterKey(pairKey, quarter))
}

export async function persistDrilldownPairData(
    pairKey: string,
    rows: PersistedDrilldownData['rows'],
    complete: boolean,
): Promise<void> {
    await persistDrilldownData({
        key: makePersistedDrilldownPairKey(pairKey),
        scope: 'pair',
        pairKey,
        quarter: null,
        rows,
        complete,
    })
}

export async function persistDrilldownQuarterData(
    pairKey: string,
    quarter: string,
    rows: PersistedDrilldownData['rows'],
    complete: boolean,
): Promise<void> {
    await persistDrilldownData({
        key: makePersistedDrilldownQuarterKey(pairKey, quarter),
        scope: 'quarter',
        pairKey,
        quarter,
        rows,
        complete,
    })
}

/**
 * Clear persisted drilldown data
 */
export async function clearPersistedDrilldownData(): Promise<void> {
    if (typeof window === 'undefined') return

    try {
        const db = getDb()
        await db.drilldown.clear()
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
        dataVersion?: string | null
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
            dataVersion: getCurrentDataVersion(),
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

        if (!isEntryForCurrentDataVersion(entry.dataVersion)) {
            await db.assetActivity.delete(key)
            return null
        }

        const maxAge = 1000 * 60 * 60 * 24
        if (hasExpiredPersistedAt(entry.persistedAt, maxAge)) {
            await db.assetActivity.delete(key)
            return null
        }

        console.log(`[AssetActivity] Loaded ${entry.rows.length} rows for ${key} from IndexedDB in ${(performance.now() - startTime).toFixed(1)}ms`)
        return {
            key: entry.key,
            rows: entry.rows,
            metadata: {
                persistedAt: entry.persistedAt,
                dataVersion: entry.dataVersion ?? null,
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
        dataVersion?: string | null
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
            dataVersion: getCurrentDataVersion(),
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

        if (!isEntryForCurrentDataVersion(entry.dataVersion)) {
            await db.investorFlow.delete(ticker)
            return null
        }

        const maxAge = 1000 * 60 * 60 * 24
        if (hasExpiredPersistedAt(entry.persistedAt, maxAge)) {
            await db.investorFlow.delete(ticker)
            return null
        }

        console.log(`[InvestorFlow] Loaded ${entry.rows.length} rows for ${ticker} from IndexedDB in ${(performance.now() - startTime).toFixed(1)}ms`)
        return {
            ticker: entry.ticker,
            rows: entry.rows,
            metadata: {
                persistedAt: entry.persistedAt,
                dataVersion: entry.dataVersion ?? null,
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

const ASSET_LIST_KEY = 'assets-v2'
const SUPERINVESTOR_LIST_CACHE_ID = 'superinvestors-v1'
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
        dataVersion?: string | null
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
        dataVersion?: string | null
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
            dataVersion: getCurrentDataVersion(),
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

        if (!isEntryForCurrentDataVersion(entry.dataVersion)) {
            await db.assetList.delete(ASSET_LIST_KEY)
            return null
        }

        if (hasExpiredPersistedAt(entry.persistedAt, LIST_CACHE_MAX_AGE_MS)) {
            await db.assetList.delete(ASSET_LIST_KEY)
            return null
        }

        console.log(`[Assets] Loaded ${entry.rows.length} rows from IndexedDB in ${(performance.now() - startTime).toFixed(1)}ms`)
        return {
            key: entry.key,
            rows: entry.rows,
            metadata: {
                persistedAt: entry.persistedAt,
                dataVersion: entry.dataVersion ?? null,
            },
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
            key: SUPERINVESTOR_LIST_CACHE_ID,
            rows,
            persistedAt: Date.now(),
            dataVersion: getCurrentDataVersion(),
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
        const entry = await db.superinvestorList.get(SUPERINVESTOR_LIST_CACHE_ID)

        if (!entry) {
            return null
        }

        if (!isEntryForCurrentDataVersion(entry.dataVersion)) {
            await db.superinvestorList.delete(SUPERINVESTOR_LIST_CACHE_ID)
            return null
        }

        if (hasExpiredPersistedAt(entry.persistedAt, LIST_CACHE_MAX_AGE_MS)) {
            await db.superinvestorList.delete(SUPERINVESTOR_LIST_CACHE_ID)
            return null
        }

        console.log(`[Superinvestors] Loaded ${entry.rows.length} rows from IndexedDB in ${(performance.now() - startTime).toFixed(1)}ms`)
        return {
            key: entry.key,
            rows: entry.rows,
            metadata: {
                persistedAt: entry.persistedAt,
                dataVersion: entry.dataVersion ?? null,
            },
        }
    } catch (error) {
        console.error('[Superinvestors] Failed to load list from IndexedDB:', error)
        return null
    }
}
