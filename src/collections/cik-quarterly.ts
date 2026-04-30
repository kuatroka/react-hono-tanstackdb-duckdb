/**
 * CIK Quarterly Data Collection
 *
 * Uses manual IndexedDB persistence for per-CIK quarterly data.
 * Data is stored per-CIK and persisted across page refreshes.
 */

import { createCollection } from '@tanstack/db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import {
    persistCikQuarterlyData,
    loadPersistedCikQuarterlyData,
    clearPersistedCikQuarterlyData,
} from './query-client'
import { queryClient } from './query-client'

export interface CikQuarterlyData {
    id: string  // cik-quarter
    cik: string
    quarter: string
    quarterEndDate: string
    totalValue: number
    totalValuePrcChg: number | null
    numAssets: number
}

interface CikQuarterlyApiRow {
    cik?: string | number | null
    quarter?: string | null
    quarterEndDate?: string | null
    totalValue?: number | null
    totalValuePrcChg?: number | null
    numAssets?: number | null
}

interface CikQuarterlyApiResponse {
    rows?: CikQuarterlyApiRow[]
}

export const cikQuarterlyCollection = createCollection(
    queryCollectionOptions<CikQuarterlyData>({
        queryKey: ['cik-quarterly-local'],
        queryFn: async () => [],
        queryClient,
        getKey: (item) => item.id,
        enabled: false,
        staleTime: Infinity,
        startSync: true,
    })
)

// In-flight fetches to prevent duplicate requests (covers both IndexedDB and API)
const inFlightFetches = new Map<string, Promise<{
    rows: CikQuarterlyData[]
    queryTimeMs: number
    fromCache: boolean
    source: 'memory' | 'indexeddb' | 'api'
}>>()

// Timing tracking for latency badge detection
export const cikQuarterlyTiming = {
    lastFetchStartedAt: null as number | null,
    lastFetchEndedAt: null as number | null,
    lastCik: null as string | null,
}

function getAllCikQuarterlyRows(): CikQuarterlyData[] {
    return Array.from(cikQuarterlyCollection.entries()).map(([, value]) => value)
}

function getRowsForCik(cik: string): CikQuarterlyData[] {
    return getAllCikQuarterlyRows()
        .filter((row) => row.cik === cik)
        .sort((left, right) => left.quarter.localeCompare(right.quarter))
}

/**
 * Check if data for a specific CIK exists in the memory cache.
 */
export function hasFetchedCikData(cik: string): boolean {
    return getRowsForCik(cik).length > 0
}

/**
 * Get CIK quarterly data from memory cache (instant).
 * Returns null if not in memory cache.
 */
export function getCikQuarterlyDataFromCache(cik: string): CikQuarterlyData[] | null {
    const rows = getRowsForCik(cik)
    return rows.length > 0 ? rows : null
}

/**
 * Fetch quarterly data for a specific CIK.
 * Checks memory cache first, then IndexedDB, then API.
 * Persists to IndexedDB after fetching from API.
 *
 * Returns the rows, fetch timing, and source information.
 */
export async function fetchCikQuarterlyData(
    cik: string
): Promise<{
    rows: CikQuarterlyData[]
    queryTimeMs: number
    fromCache: boolean
    source: 'memory' | 'indexeddb' | 'api'
}> {
    // 1. Check memory cache first (instant)
    const cached = getRowsForCik(cik)
    if (cached.length > 0) {
        return {
            rows: cached,
            queryTimeMs: 0,
            fromCache: true,
            source: 'memory'
        }
    }

    // 2. Check for in-flight request (deduplication for IndexedDB + API)
    const inFlight = inFlightFetches.get(cik)
    if (inFlight) {
        // Wait for the existing fetch to complete
        const result = await inFlight
        // Return 0ms latency since we piggybacked, but report the actual source
        return {
            rows: result.rows,
            queryTimeMs: 0,
            fromCache: true,
            source: result.source
        }
    }

    // 3. Create the fetch promise (covers both IndexedDB and API)
    const fetchPromise = (async () => {
        const startTime = performance.now()
        cikQuarterlyTiming.lastFetchStartedAt = startTime
        cikQuarterlyTiming.lastCik = cik

        // Try IndexedDB first
        const persisted = await loadPersistedCikQuarterlyData(cik)
        if (persisted && persisted.rows.length > 0) {
            cikQuarterlyCollection.utils.writeUpsert(persisted.rows)

            const elapsedMs = Math.round(performance.now() - startTime)
            cikQuarterlyTiming.lastFetchEndedAt = performance.now()

            return {
                rows: persisted.rows,
                queryTimeMs: elapsedMs,
                fromCache: true,
                source: 'indexeddb' as const
            }
        }

        // Fetch from API
        const res = await fetch(`/api/cik-quarterly/${encodeURIComponent(cik)}`)
        if (!res.ok) {
            throw new Error('Failed to fetch CIK quarterly data')
        }
        const payload = await res.json() as CikQuarterlyApiResponse | CikQuarterlyApiRow[]
        const apiRows = Array.isArray(payload) ? payload : Array.isArray(payload.rows) ? payload.rows : []

        const rows: CikQuarterlyData[] = apiRows.map((row) => ({
            id: `${row.cik}-${row.quarter}`,
            cik: String(row.cik),
            quarter: String(row.quarter),
            quarterEndDate: String(row.quarterEndDate),
            totalValue: Number(row.totalValue) || 0,
            totalValuePrcChg: row.totalValuePrcChg != null ? Number(row.totalValuePrcChg) : null,
            numAssets: Number(row.numAssets) || 0,
        }))

        cikQuarterlyCollection.utils.writeUpsert(rows)

        // Persist to IndexedDB (async, don't block)
        persistCikQuarterlyData(cik, rows).catch(err =>
            console.warn('[CikQuarterly] Failed to persist to IndexedDB:', err)
        )

        const elapsedMs = Math.round(performance.now() - startTime)
        cikQuarterlyTiming.lastFetchEndedAt = performance.now()

        console.log(`[CikQuarterly] Fetched ${rows.length} quarters for CIK ${cik} in ${elapsedMs}ms (source: api)`)

        return {
            rows,
            queryTimeMs: elapsedMs,
            fromCache: false,
            source: 'api' as const
        }
    })()

    // Register in-flight BEFORE awaiting (for deduplication)
    inFlightFetches.set(cik, fetchPromise)

    try {
        const result = await fetchPromise
        return result
    } finally {
        inFlightFetches.delete(cik)
    }
}

/**
 * Prefetch CIK quarterly data in the background.
 * Useful for preloading data before navigation.
 */
export async function prefetchCikQuarterlyData(cik: string): Promise<void> {
    // Just call fetchCikQuarterlyData - it handles caching
    await fetchCikQuarterlyData(cik)
}

/**
 * Invalidate CIK quarterly data, forcing a refetch on next access.
 * Clears both memory cache and IndexedDB.
 */
export async function invalidateCikQuarterlyData(cik: string): Promise<void> {
    const ids = getRowsForCik(cik).map((row) => row.id)
    if (ids.length > 0) {
        cikQuarterlyCollection.utils.writeDelete(ids)
    }
    await clearPersistedCikQuarterlyData(cik)
}

/**
 * Clear all CIK quarterly data from memory cache.
 * Does not clear IndexedDB (call invalidateCikQuarterlyData for that).
 */
export function clearAllCikQuarterlyData(): void {
    const ids = getAllCikQuarterlyRows().map((row) => row.id)
    if (ids.length > 0) {
        cikQuarterlyCollection.utils.writeDelete(ids)
    }
}
