import { createCollection } from '@tanstack/db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import { queryClient } from './instances'
import {
    clearPersistedDrilldownData as clearPersistedDrilldownDataDefault,
    loadPersistedDrilldownPairData as loadPersistedDrilldownPairDataDefault,
    loadPersistedDrilldownQuarterData as loadPersistedDrilldownQuarterDataDefault,
    persistDrilldownPairData as persistDrilldownPairDataDefault,
    persistDrilldownQuarterData as persistDrilldownQuarterDataDefault,
    type PersistedDrilldownData,
} from './query-client'

type DrilldownPersistence = {
    clearPersistedDrilldownData: typeof clearPersistedDrilldownDataDefault
    loadPersistedDrilldownPairData: typeof loadPersistedDrilldownPairDataDefault
    loadPersistedDrilldownQuarterData: typeof loadPersistedDrilldownQuarterDataDefault
    persistDrilldownPairData: typeof persistDrilldownPairDataDefault
    persistDrilldownQuarterData: typeof persistDrilldownQuarterDataDefault
}

const drilldownPersistence: DrilldownPersistence = {
    clearPersistedDrilldownData: clearPersistedDrilldownDataDefault,
    loadPersistedDrilldownPairData: loadPersistedDrilldownPairDataDefault,
    loadPersistedDrilldownQuarterData: loadPersistedDrilldownQuarterDataDefault,
    persistDrilldownPairData: persistDrilldownPairDataDefault,
    persistDrilldownQuarterData: persistDrilldownQuarterDataDefault,
}

export function __setDrilldownPersistenceForTest(overrides: Partial<DrilldownPersistence>): () => void {
    const previous = { ...drilldownPersistence }
    Object.assign(drilldownPersistence, overrides)
    return () => Object.assign(drilldownPersistence, previous)
}

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
    })
)

function getAllDrilldownRows(): InvestorDetail[] {
    flushBufferedRowsIfReady()

    const merged = new Map<string, InvestorDetail>()
    for (const [id, value] of investorDrilldownCollection.entries()) {
        merged.set(id, value)
    }
    for (const [id, value] of bufferedRows.entries()) {
        merged.set(id, value)
    }
    return Array.from(merged.values())
}

const fetchedCombinations = new Set<string>()

const inFlightBothActionsFetches = new Map<string, Promise<{ rows: InvestorDetail[], queryTimeMs: number, complete: boolean }>>()

const inFlightBulkFetches = new Map<string, Promise<void>>()

const bulkFetchedPairs = new Set<string>()
const incompleteQuarterScopes = new Set<string>()
const incompleteBulkPairs = new Set<string>()
const indexedDBLoadedKeys = new Set<string>()
const bufferedRows = new Map<string, InvestorDetail>()

function isSyncNotInitializedError(error: unknown): boolean {
    return error instanceof Error && error.message.includes('SyncNotInitializedError')
}

function flushBufferedRowsIfReady(): void {
    if (bufferedRows.size === 0 || !investorDrilldownCollection.isReady()) {
        return
    }

    const rows = Array.from(bufferedRows.values())
    try {
        investorDrilldownCollection.utils.writeUpsert(rows)
        bufferedRows.clear()
    } catch (error) {
        if (!isSyncNotInitializedError(error)) {
            throw error
        }
    }
}

function safeWriteUpsert(rows: InvestorDetail[]): void {
    if (rows.length === 0) {
        return
    }

    if (investorDrilldownCollection.isReady()) {
        try {
            investorDrilldownCollection.utils.writeUpsert(rows)
            for (const row of rows) {
                bufferedRows.delete(row.id)
            }
            return
        } catch (error) {
            if (!isSyncNotInitializedError(error)) {
                throw error
            }
        }
    }

    for (const row of rows) {
        bufferedRows.set(row.id, row)
    }
}

function safeWriteDelete(ids: string[]): void {
    if (ids.length === 0) {
        return
    }

    for (const id of ids) {
        bufferedRows.delete(id)
    }

    if (!investorDrilldownCollection.isReady()) {
        return
    }

    try {
        investorDrilldownCollection.utils.writeDelete(ids)
    } catch (error) {
        if (!isSyncNotInitializedError(error)) {
            throw error
        }
    }
}

const inFlightIndexedDBLoads = new Map<string, Promise<boolean>>()

export function isDrilldownIndexedDBLoaded(ticker: string, cusip: string, quarter?: string): boolean {
    const pairKey = makePairKey(ticker, cusip)
    if (quarter) {
        return indexedDBLoadedKeys.has(`quarter:${pairKey}:${quarter}`)
    }

    return indexedDBLoadedKeys.has(`pair:${pairKey}`)
}

function restorePersistedDrilldownRows(persisted: PersistedDrilldownData): boolean {
    if (persisted.rows.length === 0) {
        if (persisted.scope === 'quarter' && persisted.quarter) {
            const { ticker, cusip } = parsePairKey(persisted.pairKey)
            markQuarterScopeComplete(ticker, cusip, persisted.quarter, persisted.complete)
            return persisted.complete
        }

        if (persisted.scope === 'pair') {
            markPairScopeComplete(persisted.pairKey, persisted.complete)
            return persisted.complete
        }

        return false
    }

    safeWriteUpsert(persisted.rows)

    if (persisted.scope === 'quarter' && persisted.quarter) {
        const { ticker, cusip } = parsePairKey(persisted.pairKey)
        markQuarterScopeComplete(ticker, cusip, persisted.quarter, persisted.complete)
    }

    if (persisted.scope === 'pair') {
        markPairScopeComplete(persisted.pairKey, persisted.complete)
    }

    return true
}

/**
 * Load drilldown data from IndexedDB into the collection.
 * Returns true if data was loaded, false otherwise.
 */
export async function loadDrilldownFromIndexedDB(ticker: string, cusip: string, quarter?: string): Promise<boolean> {
    const pairKey = makePairKey(ticker, cusip)
    const scopeKey = quarter ? `quarter:${pairKey}:${quarter}` : `pair:${pairKey}`
    if (indexedDBLoadedKeys.has(scopeKey)) {
        return quarter
            ? getDrilldownDataForQuarter(ticker, cusip, quarter).length > 0
            : getPairScopeRows(pairKey).length > 0
    }

    const inFlight = inFlightIndexedDBLoads.get(scopeKey)
    if (inFlight) {
        return inFlight
    }

    const promise = (async () => {
        indexedDBLoadedKeys.add(scopeKey)
        try {
            const persistedScopes = quarter
                ? [
                    await drilldownPersistence.loadPersistedDrilldownQuarterData(pairKey, quarter),
                    await drilldownPersistence.loadPersistedDrilldownPairData(pairKey),
                ]
                : [await drilldownPersistence.loadPersistedDrilldownPairData(pairKey)]

            let restored = false
            for (const persisted of persistedScopes) {
                if (!persisted) {
                    continue
                }

                restored = restorePersistedDrilldownRows(persisted) || restored
                if (restored) {
                    console.log(`[Drilldown] Restored ${persisted.rows.length} rows from IndexedDB for ${persisted.key}`)
                }
            }

            return restored
        } catch (error) {
            console.error('[Drilldown] Failed to load from IndexedDB:', error)
            return false
        }
    })()

    inFlightIndexedDBLoads.set(scopeKey, promise)
    try {
        return await promise
    } finally {
        inFlightIndexedDBLoads.delete(scopeKey)
    }
}

async function saveQuarterDrilldownToIndexedDB(ticker: string, cusip: string, quarter: string, complete: boolean): Promise<void> {
    const pairKey = makePairKey(ticker, cusip)
    const rows = getDrilldownDataForQuarter(ticker, cusip, quarter)
    await drilldownPersistence.persistDrilldownQuarterData(pairKey, quarter, rows, complete)
}

async function savePairDrilldownToIndexedDB(ticker: string, cusip: string, complete: boolean): Promise<void> {
    const pairKey = makePairKey(ticker, cusip)
    await drilldownPersistence.persistDrilldownPairData(pairKey, getPairScopeRows(pairKey), complete)
}

function getDrilldownDataForQuarter(ticker: string, cusip: string, quarter: string): InvestorDetail[] {
    return getAllDrilldownRows().filter((item) => item.ticker === ticker && item.cusip === cusip && item.quarter === quarter)
}

/**
 * Check if data was loaded from IndexedDB (for latency badge source detection)
 */
export function wasLoadedFromIndexedDB(ticker: string, cusip: string, quarter?: string): boolean {
    return isDrilldownIndexedDBLoaded(ticker, cusip, quarter)
}

function makePairKey(ticker: string, cusip: string): string {
    return `${ticker}::${cusip}`
}

function getRowsForPair(allRows: InvestorDetail[], ticker: string, cusip: string): InvestorDetail[] {
    return allRows.filter((r) => r.ticker === ticker && r.cusip === cusip)
}

function parsePairKey(pairKey: string): { ticker: string, cusip: string } {
    const separator = '::'
    const separatorIndex = pairKey.indexOf(separator)
    if (separatorIndex === -1) {
        return { ticker: pairKey, cusip: '' }
    }

    return {
        ticker: pairKey.slice(0, separatorIndex),
        cusip: pairKey.slice(separatorIndex + separator.length),
    }
}

function getQuarterScopeKey(ticker: string, cusip: string, quarter: string): string {
    return `${ticker}-${cusip}-${quarter}`
}

function getPairScopeRows(pairKey: string): InvestorDetail[] {
    const { ticker, cusip } = parsePairKey(pairKey)
    return getRowsForPair(getAllDrilldownRows(), ticker, cusip)
}

function getDrilldownRowsForAction(ticker: string, cusip: string, quarter: string, action: 'open' | 'close'): InvestorDetail[] {
    return getAllDrilldownRows().filter((item) => item.ticker === ticker && item.cusip === cusip && item.quarter === quarter && item.action === action)
}

function markQuarterScopeComplete(ticker: string, cusip: string, quarter: string, complete: boolean): void {
    const scopeKey = getQuarterScopeKey(ticker, cusip, quarter)
    const openKey = `${ticker}-${cusip}-${quarter}-open`
    const closeKey = `${ticker}-${cusip}-${quarter}-close`

    if (complete) {
        fetchedCombinations.add(openKey)
        fetchedCombinations.add(closeKey)
        incompleteQuarterScopes.delete(scopeKey)
        return
    }

    fetchedCombinations.delete(openKey)
    fetchedCombinations.delete(closeKey)
    incompleteQuarterScopes.add(scopeKey)
}

function markPairScopeComplete(pairKey: string, complete: boolean): void {
    if (complete) {
        bulkFetchedPairs.add(pairKey)
        incompleteBulkPairs.delete(pairKey)
        return
    }

    bulkFetchedPairs.delete(pairKey)
    incompleteBulkPairs.add(pairKey)
}

/**
 * Check if data for a specific [ticker, cusip, quarter, action] has been fetched
 */
export function hasFetchedDrilldownData(ticker: string, cusip: string, quarter: string, action: 'open' | 'close'): boolean {
    const pairKey = makePairKey(ticker, cusip)
    if (bulkFetchedPairs.has(pairKey) && !incompleteBulkPairs.has(pairKey)) {
        return true
    }

    if (incompleteQuarterScopes.has(getQuarterScopeKey(ticker, cusip, quarter))) {
        return false
    }

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
    if (hasFetchedDrilldownData(ticker, cusip, quarter, action)) {
        return {
            rows: getDrilldownRowsForAction(ticker, cusip, quarter, action),
            queryTimeMs: 0,
            fromCache: true,
        }
    }

    const result = await fetchDrilldownBothActions(ticker, cusip, quarter)
    return {
        rows: result.rows.filter((row) => row.action === action),
        queryTimeMs: result.queryTimeMs,
        fromCache: result.queryTimeMs === 0,
    }
}

/**
 * Fetch BOTH actions for a specific quarter in one round trip and upsert.
 * Returns combined rows and timing; marks both action combinations as fetched only when complete.
 */
export async function fetchDrilldownBothActions(
    ticker: string,
    cusip: string,
    quarter: string,
): Promise<{ rows: InvestorDetail[], queryTimeMs: number, complete: boolean }> {
    const bothKey = `${ticker}-${cusip}-${quarter}-both`
    const inFlight = inFlightBothActionsFetches.get(bothKey)
    if (inFlight) {
        return inFlight
    }

    const getResolvedQuarterRows = () => getDrilldownDataForQuarter(ticker, cusip, quarter)
    if (hasFetchedDrilldownData(ticker, cusip, quarter, 'open') && hasFetchedDrilldownData(ticker, cusip, quarter, 'close')) {
        return { rows: getResolvedQuarterRows(), queryTimeMs: 0, complete: true }
    }

    const promise = (async () => {
        await loadDrilldownFromIndexedDB(ticker, cusip, quarter)

        if (hasFetchedDrilldownData(ticker, cusip, quarter, 'open') && hasFetchedDrilldownData(ticker, cusip, quarter, 'close')) {
            return { rows: getResolvedQuarterRows(), queryTimeMs: 0, complete: true }
        }

        const startTime = performance.now()
        const searchParams = new URLSearchParams()
        searchParams.set('ticker', ticker)
        searchParams.set('cusip', cusip)
        searchParams.set('quarter', quarter)
        searchParams.set('action', 'both')
        searchParams.set('limit', '2000')

        const res = await fetch(`/api/duckdb-investor-drilldown?${searchParams.toString()}`)
        if (!res.ok) throw new Error('Failed to fetch investor details (both actions)')
        const data = await res.json() as { rows?: DrilldownApiRow[], complete?: boolean }

        const rows: InvestorDetail[] = (Array.isArray(data.rows) ? data.rows : []).map((row) => {
            const resolvedAction: 'open' | 'close' = row.action === 'close' ? 'close' : 'open'
            const rowCusip = row.cusip ?? cusip
            return {
                id: `${rowCusip ?? 'nocusip'}-${row.quarter ?? quarter}-${resolvedAction}-${row.cik ?? 'nocik'}`,
                ticker,
                cik: row.cik != null ? String(row.cik) : '',
                cikName: row.cikName ?? '',
                cikTicker: row.cikTicker ?? '',
                quarter: row.quarter ?? quarter,
                cusip: rowCusip ?? null,
                action: resolvedAction,
                didOpen: row.didOpen ?? null,
                didAdd: row.didAdd ?? null,
                didReduce: row.didReduce ?? null,
                didClose: row.didClose ?? null,
                didHold: row.didHold ?? null,
            }
        })

        safeWriteUpsert(rows)

        const complete = Boolean(data.complete)
        markQuarterScopeComplete(ticker, cusip, quarter, complete)

        const elapsedMs = Math.round(performance.now() - startTime)
        saveQuarterDrilldownToIndexedDB(ticker, cusip, quarter, complete).catch((error) => {
            console.warn('[Drilldown] Failed to persist quarter scope:', error)
        })

        return {
            rows: getResolvedQuarterRows(),
            queryTimeMs: elapsedMs,
            complete,
        }
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
        await loadDrilldownFromIndexedDB(ticker, cusip)
        if (bulkFetchedPairs.has(pairKey) && !incompleteBulkPairs.has(pairKey)) {
            onProgress?.(1, 1)
            console.debug(`[Background Load] ${ticker}/${cusip}: skipping bulk fetch (already cached locally)`)
            return
        }

        const startMs = performance.now()
        const searchParams = new URLSearchParams()
        searchParams.set('ticker', ticker)
        searchParams.set('cusip', cusip)
        searchParams.set('quarter', 'all')
        searchParams.set('action', 'both')
        searchParams.set('limit', '5000')

        const res = await fetch(`/api/duckdb-investor-drilldown?${searchParams.toString()}`)
        if (!res.ok) {
            console.warn(`[Background Load] ${ticker}/${cusip}: bulk fetch failed`, await res.text())
            onProgress?.(1, 1)
            return
        }

        const data = await res.json() as { rows?: DrilldownApiRow[], complete?: boolean }
        const rows: InvestorDetail[] = (Array.isArray(data.rows) ? data.rows : []).map((row) => {
            const rowCusip = row.cusip ?? cusip
            return {
                id: `${rowCusip ?? 'nocusip'}-${row.quarter ?? 'unknown'}-${row.action ?? 'open'}-${row.cik ?? 'nocik'}`,
                ticker,
                cik: row.cik != null ? String(row.cik) : '',
                cikName: row.cikName ?? '',
                cikTicker: row.cikTicker ?? '',
                quarter: row.quarter ?? 'unknown',
                cusip: rowCusip ?? null,
                action: row.action === 'close' ? 'close' : 'open',
                didOpen: row.didOpen ?? null,
                didAdd: row.didAdd ?? null,
                didReduce: row.didReduce ?? null,
                didClose: row.didClose ?? null,
                didHold: row.didHold ?? null,
            }
        })

        safeWriteUpsert(rows)

        const complete = Boolean(data.complete)
        markPairScopeComplete(pairKey, complete)
        onProgress?.(1, 1)
        const elapsedMs = Math.round(performance.now() - startMs)
        console.log(`[Background Load] ${ticker}/${cusip}: fetched ${rows.length} rows in one bulk call (wall=${elapsedMs}ms, complete=${complete})`)

        savePairDrilldownToIndexedDB(ticker, cusip, complete).catch((error) => {
            console.warn('[Drilldown] Failed to persist pair scope:', error)
        })
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

    return getDrilldownRowsForAction(ticker, cusip, quarter, action)
}

function resetDrilldownState(clearPersistedCache: boolean): void {
    const ids = getAllDrilldownRows().map((row) => row.id)
    if (ids.length > 0) {
        safeWriteDelete(ids)
    }

    bufferedRows.clear()
    fetchedCombinations.clear()
    inFlightBothActionsFetches.clear()
    inFlightBulkFetches.clear()
    bulkFetchedPairs.clear()
    incompleteQuarterScopes.clear()
    incompleteBulkPairs.clear()
    indexedDBLoadedKeys.clear()
    inFlightIndexedDBLoads.clear()

    if (clearPersistedCache) {
        drilldownPersistence.clearPersistedDrilldownData().catch((error) => {
            console.warn('[Drilldown] Failed to clear persisted cache:', error)
        })
    }
}

export function clearDrilldownSessionState(): void {
    resetDrilldownState(false)
}

export function clearAllDrilldownData(): void {
    resetDrilldownState(true)
}
