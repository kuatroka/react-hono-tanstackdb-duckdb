import { createCollection } from '@tanstack/db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import { queryClient } from './instances'
import { 
    persistDrilldownData, 
    loadPersistedDrilldownData,
    clearPersistedDrilldownData,
    type PersistedDrilldownData 
} from './query-client'

export interface InvestorDetail {
    id: string  // Unique key: cusip-quarter-action-cik
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
}

interface DrilldownApiRow {
    action?: 'open' | 'close' | null
    cik?: string | number | null
    cikName?: string | null
    cikTicker?: string | null
    quarter?: string | null
    cusip?: string | null
    didOpen?: boolean | null
    didAdd?: boolean | null
    didReduce?: boolean | null
    didClose?: boolean | null
    didHold?: boolean | null
}

// TanStack DB collection that holds all drill-down rows (all quarters/actions per ticker)
// The queryFn returns an empty array; we populate the collection via writeUpsert
// from fetchDrilldownData/backgroundLoadAllDrilldownData to keep reactive reads.
export const investorDrilldownCollection = createCollection(
    queryCollectionOptions<InvestorDetail>({
        queryKey: ['investor-drilldown'],
        queryFn: async () => [],
        queryClient,
        getKey: (item) => item.id,
        enabled: false, // manual writes only; avoid auto-refetch wiping data
        staleTime: Infinity,
        startSync: true,
    })
)

function getAllDrilldownRows(): InvestorDetail[] {
    return Array.from(investorDrilldownCollection.entries()).map(([, value]) => value)
}

const fetchedCombinations = new Set<string>()

const inFlightBothActionsFetches = new Map<string, Promise<{ rows: InvestorDetail[], queryTimeMs: number }>>()

const inFlightBulkFetches = new Map<string, Promise<void>>()

const bulkFetchedPairs = new Set<string>()

// Track if we've loaded from IndexedDB
let indexedDBLoaded = false
let indexedDBLoadPromise: Promise<boolean> | null = null

export function isDrilldownIndexedDBLoaded(): boolean {
    return indexedDBLoaded
}

/**
 * Load drilldown data from IndexedDB into the collection.
 * Returns true if data was loaded, false otherwise.
 */
export async function loadDrilldownFromIndexedDB(): Promise<boolean> {
    if (indexedDBLoaded) return true
    if (indexedDBLoadPromise) return indexedDBLoadPromise
    
    indexedDBLoadPromise = (async () => {
        try {
            const persisted = await loadPersistedDrilldownData()
            if (!persisted || persisted.rows.length === 0) {
                indexedDBLoaded = true
                return false
            }
            
            // Restore rows to collection
            investorDrilldownCollection.utils.writeUpsert(persisted.rows)
            
            // Restore fetched combinations
            for (const combo of persisted.fetchedCombinations) {
                fetchedCombinations.add(combo)
            }
            
            // Restore bulk fetched pairs
            for (const pair of persisted.bulkFetchedPairs) {
                bulkFetchedPairs.add(pair)
            }
            
            indexedDBLoaded = true
            console.log(`[Drilldown] Restored ${persisted.rows.length} rows from IndexedDB`)
            return true
        } catch (error) {
            console.error('[Drilldown] Failed to load from IndexedDB:', error)
            indexedDBLoaded = true
            return false
        }
    })()
    
    return indexedDBLoadPromise
}

/**
 * Save current drilldown data to IndexedDB.
 * Call this after fetching new data.
 */
export async function saveDrilldownToIndexedDB(): Promise<void> {
    const rows = getAllDrilldownRows()
    if (rows.length === 0) return
    
    const data: PersistedDrilldownData = {
        rows,
        fetchedCombinations: Array.from(fetchedCombinations),
        bulkFetchedPairs: Array.from(bulkFetchedPairs),
    }
    
    await persistDrilldownData(data)
}

/**
 * Check if data was loaded from IndexedDB (for latency badge source detection)
 */
export function wasLoadedFromIndexedDB(): boolean {
    return indexedDBLoaded && getAllDrilldownRows().length > 0
}

function makePairKey(ticker: string, cusip: string): string {
    return `${ticker}-${cusip}`
}

function getRowsForPair(allRows: InvestorDetail[], ticker: string, cusip: string): InvestorDetail[] {
    return allRows.filter((r) => r.ticker === ticker && r.cusip === cusip)
}

function inferBulkFetchedFromRows(allRows: InvestorDetail[], ticker: string, cusip: string): boolean {
    const pairRows = getRowsForPair(allRows, ticker, cusip)
    if (pairRows.length === 0) return false
    const distinctQuarters = new Set(pairRows.map((r) => r.quarter))
    // If we already have multiple quarters locally, assume bulk load ran before.
    return distinctQuarters.size >= 2
}

/**
 * Check if data for a specific [ticker, cusip, quarter, action] has been fetched
 */
export function hasFetchedDrilldownData(ticker: string, cusip: string, quarter: string, action: 'open' | 'close'): boolean {
    return fetchedCombinations.has(`${ticker}-${cusip}-${quarter}-${action}`)
}

/**
 * Fetch drill-down data for a specific [ticker, cusip, quarter, action] and add it to the TanStack DB collection.
 * Returns the fetched rows and query time.
 */
export async function fetchDrilldownData(
    ticker: string,
    cusip: string,
    quarter: string,
    action: 'open' | 'close'
): Promise<{ rows: InvestorDetail[], queryTimeMs: number, fromCache: boolean }> {
    const cacheKey = `${ticker}-${cusip}-${quarter}-${action}`

    const cachedRows = getAllDrilldownRows().filter((item) => item.ticker === ticker && item.cusip === cusip && item.quarter === quarter && item.action === action)
    if (cachedRows.length > 0) {
        fetchedCombinations.add(cacheKey)
        return { rows: cachedRows, queryTimeMs: 0, fromCache: true }
    }

    if (fetchedCombinations.has(cacheKey)) {
        return { rows: [], queryTimeMs: 0, fromCache: true }
    }

    const result = await fetchDrilldownBothActions(ticker, cusip, quarter)
    const filtered = (result.rows || []).filter((r) => r.action === action)
    fetchedCombinations.add(cacheKey)
    return { rows: filtered, queryTimeMs: result.queryTimeMs, fromCache: result.queryTimeMs === 0 }
}

/**
 * Fetch BOTH actions for a specific quarter in one round trip and upsert.
 * Returns combined rows and timing; marks both action combinations as fetched.
 */
export async function fetchDrilldownBothActions(
    ticker: string,
    cusip: string,
    quarter: string,
): Promise<{ rows: InvestorDetail[], queryTimeMs: number }> {
    const bothKey = `${ticker}-${cusip}-${quarter}-both`
    const inFlight = inFlightBothActionsFetches.get(bothKey)
    if (inFlight) {
        return inFlight
    }

    const openKey = `${ticker}-${cusip}-${quarter}-open`
    const closeKey = `${ticker}-${cusip}-${quarter}-close`

    const allRows = getAllDrilldownRows()
    const cachedRows = allRows.filter(
        (item) =>
            item.ticker === ticker &&
            item.cusip === cusip &&
            item.quarter === quarter &&
            (item.action === 'open' || item.action === 'close')
    )

    const openCached = cachedRows.some((r) => r.action === 'open')
    const closeCached = cachedRows.some((r) => r.action === 'close')
    const openFetched = openCached || fetchedCombinations.has(openKey)
    const closeFetched = closeCached || fetchedCombinations.has(closeKey)

    if (openFetched && closeFetched) {
        fetchedCombinations.add(openKey)
        fetchedCombinations.add(closeKey)
        return { rows: cachedRows, queryTimeMs: 0 }
    }

    const promise = (async () => {
        const startTime = performance.now()

        const searchParams = new URLSearchParams()
        searchParams.set('ticker', ticker)
        searchParams.set('cusip', cusip)
        searchParams.set('quarter', quarter)
        searchParams.set('action', 'both')
        searchParams.set('limit', '2000')

        const res = await fetch(`/api/duckdb-investor-drilldown?${searchParams.toString()}`)
        if (!res.ok) throw new Error('Failed to fetch investor details (both actions)')
        const data = await res.json()

        const rows: InvestorDetail[] = ((data.rows || []) as DrilldownApiRow[]).map((row) => {
            const action: 'open' | 'close' = row.action === 'close' ? 'close' : 'open'
            const rowCusip = row.cusip ?? cusip
            return {
                id: `${rowCusip ?? 'nocusip'}-${row.quarter ?? quarter}-${action}-${row.cik ?? 'nocik'}`,
                ticker,
                cik: row.cik != null ? String(row.cik) : '',
                cikName: row.cikName ?? '',
                cikTicker: row.cikTicker ?? '',
                quarter: row.quarter ?? quarter,
                cusip: rowCusip ?? null,
                action,
                didOpen: row.didOpen ?? null,
                didAdd: row.didAdd ?? null,
                didReduce: row.didReduce ?? null,
                didClose: row.didClose ?? null,
                didHold: row.didHold ?? null,
            }
        })

        const existingIds = new Set(getAllDrilldownRows().map(r => r.id))
        const dedupedRows = rows.filter(r => !existingIds.has(r.id))
        if (dedupedRows.length > 0) {
            investorDrilldownCollection.utils.writeUpsert(dedupedRows)
        }

        fetchedCombinations.add(`${ticker}-${cusip}-${quarter}-open`)
        fetchedCombinations.add(`${ticker}-${cusip}-${quarter}-close`)

        const elapsedMs = Math.round(performance.now() - startTime)
        
        // Persist to IndexedDB after fetching
        saveDrilldownToIndexedDB().catch(err => console.warn('[Drilldown] Failed to persist:', err))
        
        return { rows, queryTimeMs: elapsedMs }
    })()

    inFlightBothActionsFetches.set(bothKey, promise)
    promise.finally(() => {
        inFlightBothActionsFetches.delete(bothKey)
    })
    return promise
}

/**
 * Background load all drill-down data for a ticker and cusip.
 * Bulk fetches ALL quarters/actions in a single request for speed.
 */
export async function backgroundLoadAllDrilldownData(
    ticker: string,
    cusip: string,
    _quarters: string[],
    onProgress?: (loaded: number, total: number) => void
): Promise<void> {
    const pairKey = makePairKey(ticker, cusip)

    const inFlight = inFlightBulkFetches.get(pairKey)
    if (inFlight) {
        return inFlight
    }

    const promise = (async () => {

    // Seed fetched set with existing collection rows to avoid refetching on refresh
    const existingRows = getAllDrilldownRows()
    for (const row of existingRows) {
        fetchedCombinations.add(`${row.ticker}-${row.cusip}-${row.quarter}-${row.action}`)
    }

    if (bulkFetchedPairs.has(pairKey) || inferBulkFetchedFromRows(existingRows, ticker, cusip)) {
        bulkFetchedPairs.add(pairKey)
        onProgress?.(1, 1)
        console.debug(`[Background Load] ${ticker}/${cusip}: skipping bulk fetch (already cached locally)`)
        return
    }

    // Bulk load everything in one call (fastest overall; route caps rows to keep payload reasonable)
    const startMs = performance.now()
    const searchParams = new URLSearchParams()
    searchParams.set('ticker', ticker)
    searchParams.set('cusip', cusip)
    searchParams.set('quarter', 'all')
    searchParams.set('action', 'both')
    searchParams.set('limit', '5000') // route caps at 5000 rows

    const res = await fetch(`/api/duckdb-investor-drilldown?${searchParams.toString()}`)
    if (!res.ok) {
        console.warn(`[Background Load] ${ticker}/${cusip}: bulk fetch failed`, await res.text())
        onProgress?.(1, 1)
        return
    }
    const data = await res.json()

    const rows: InvestorDetail[] = ((data.rows || []) as DrilldownApiRow[]).map((row) => {
        const rowCusip = row.cusip ?? cusip
        return {
            id: `${rowCusip ?? 'nocusip'}-${row.quarter ?? 'unknown'}-${row.action ?? 'open'}-${row.cik ?? 'nocik'}`,
            ticker,
            cik: row.cik != null ? String(row.cik) : '',
            cikName: row.cikName ?? '',
            cikTicker: row.cikTicker ?? '',
            quarter: row.quarter ?? 'unknown',
            cusip: rowCusip ?? null,
            action: (row.action === 'close' ? 'close' : 'open'),
            didOpen: row.didOpen ?? null,
            didAdd: row.didAdd ?? null,
            didReduce: row.didReduce ?? null,
            didClose: row.didClose ?? null,
            didHold: row.didHold ?? null,
        }
    })

    const existingIds = new Set(getAllDrilldownRows().map(r => r.id))
    const dedupedRows = rows.filter(r => !existingIds.has(r.id))
    if (dedupedRows.length > 0) {
        investorDrilldownCollection.utils.writeUpsert(dedupedRows)
    }

    // Mark fetched combinations so table reads are instant
    for (const r of rows) {
        fetchedCombinations.add(`${r.ticker}-${r.cusip}-${r.quarter}-${r.action}`)
    }

    bulkFetchedPairs.add(pairKey)
    onProgress?.(1, 1)
    const elapsedMs = Math.round(performance.now() - startMs)
    console.log(`[Background Load] ${ticker}/${cusip}: fetched ${rows.length} rows in one bulk call (wall=${elapsedMs}ms)`)
    
    // Persist to IndexedDB after bulk fetch
    saveDrilldownToIndexedDB().catch(err => console.warn('[Drilldown] Failed to persist:', err))
    })()

    inFlightBulkFetches.set(pairKey, promise)
    promise.finally(() => {
        inFlightBulkFetches.delete(pairKey)
    })
    return promise
}

/**
 * Get drill-down data from the TanStack DB collection (instant query).
 * Returns null if data hasn't been fetched yet.
 */
export function getDrilldownDataFromCollection(
    ticker: string,
    cusip: string,
    quarter: string,
    action: 'open' | 'close'
): InvestorDetail[] | null {
    if (!hasFetchedDrilldownData(ticker, cusip, quarter, action)) {
        return null
    }

    return getAllDrilldownRows().filter((item) => item.ticker === ticker && item.cusip === cusip && item.quarter === quarter && item.action === action)
}

export function clearAllDrilldownData(): void {
    const ids = getAllDrilldownRows().map((row) => row.id)
    if (ids.length > 0) {
        investorDrilldownCollection.utils.writeDelete(ids)
    }

    fetchedCombinations.clear()
    inFlightBothActionsFetches.clear()
    inFlightBulkFetches.clear()
    bulkFetchedPairs.clear()
    indexedDBLoaded = false
    indexedDBLoadPromise = null
    clearPersistedDrilldownData().catch((error) => {
        console.warn('[Drilldown] Failed to clear persisted cache:', error)
    })
}
