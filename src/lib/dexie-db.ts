/**
 * Dexie Database Schema
 *
 * Single IndexedDB database for all app cache data.
 * Provides proper connection lifecycle management for reliable cache invalidation.
 *
 * Tables:
 * - queryCache: TanStack Query persisted cache entries
 * - searchIndex: Pre-computed search index for instant search
 * - cikQuarterly: Per-CIK quarterly data for charts
 */

import Dexie, { type Table } from 'dexie'

/**
 * TanStack Query cache entry
 */
export interface QueryCacheEntry {
    key: string
    data: unknown
    timestamp: number
}

/**
 * Pre-computed search index entry
 */
export interface SearchIndexEntry {
    key: string
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
 * CIK quarterly data entry for superinvestor charts
 */
export interface CikQuarterlyEntry {
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
    persistedAt: number
}

/**
 * Drilldown data entry for investor details
 */
export interface DrilldownEntry {
    key: string
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

export interface AssetActivityEntry {
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
    persistedAt: number
}

export interface InvestorFlowEntry {
    ticker: string
    rows: Array<{
        id: string
        ticker: string
        quarter: string
        inflow: number
        outflow: number
    }>
    persistedAt: number
}

export interface AssetListEntry {
    key: string
    rows: Array<{
        id: string
        asset: string
        assetName: string
        cusip: string | null
    }>
    persistedAt: number
}

export interface SuperinvestorListEntry {
    key: string
    rows: Array<{
        id: string
        cik: string
        cikName: string
    }>
    persistedAt: number
}

/**
 * App cache database extending Dexie
 */
export class AppCacheDB extends Dexie {
    queryCache!: Table<QueryCacheEntry, string>
    searchIndex!: Table<SearchIndexEntry, string>
    cikQuarterly!: Table<CikQuarterlyEntry, string>
    drilldown!: Table<DrilldownEntry, string>
    assetActivity!: Table<AssetActivityEntry, string>
    investorFlow!: Table<InvestorFlowEntry, string>
    assetList!: Table<AssetListEntry, string>
    superinvestorList!: Table<SuperinvestorListEntry, string>

    constructor() {
        super('app-cache')
        this.version(1).stores({
            queryCache: 'key',
            searchIndex: 'key',
            cikQuarterly: 'cik',
            drilldown: 'key'
        })
        this.version(2).stores({
            queryCache: 'key',
            searchIndex: 'key',
            cikQuarterly: 'cik',
            drilldown: 'key',
            assetActivity: 'key',
            investorFlow: 'ticker',
        })
        this.version(3).stores({
            queryCache: 'key',
            searchIndex: 'key',
            cikQuarterly: 'cik',
            drilldown: 'key',
            assetActivity: 'key',
            investorFlow: 'ticker',
            assetList: 'key',
            superinvestorList: 'key',
        })
    }
}

// Singleton database instance
let db = new AppCacheDB()

/**
 * Get the database instance
 */
export function getDb(): AppCacheDB {
    return db
}

/**
 * Invalidate the entire database
 * Closes connection, deletes database, and reopens with fresh instance.
 * This is the key function that enables cache invalidation without page reload.
 */
export async function invalidateDatabase(): Promise<void> {
    console.log('[Dexie] Closing database...')
    db.close()
    console.log('[Dexie] Database closed')

    console.log('[Dexie] Deleting database...')
    await Dexie.delete('app-cache')
    console.log('[Dexie] Database deleted')

    // Create fresh instance
    db = new AppCacheDB()
    await db.open()
    console.log('[Dexie] Database reopened: app-cache')
}

/**
 * Open the database (call on app init)
 */
export async function openDatabase(): Promise<void> {
    if (!db.isOpen()) {
        await db.open()
        console.log('[Dexie] Database opened: app-cache')
    }
}

// Export the singleton instance for direct access
export { db }
