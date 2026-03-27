import { createCollection } from '@tanstack/db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import { queryClient } from './query-client'
import {
    loadPersistedAssetActivityData,
    persistAssetActivityData,
} from './query-client'

export interface AssetActivityData {
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
}

type AssetActivitySource = 'memory' | 'indexeddb' | 'api'

interface AssetActivityApiRow {
    quarter?: string | null
    numOpen?: number | null
    numAdd?: number | null
    numReduce?: number | null
    numClose?: number | null
    numHold?: number | null
    cusip?: string | null
    ticker?: string | null
    opened?: number | null
    closed?: number | null
}

export const assetActivityCollection = createCollection(
    queryCollectionOptions<AssetActivityData>({
        queryKey: ['asset-activity'],
        queryFn: async () => [],
        queryClient,
        getKey: (item) => item.id,
        enabled: false,
        staleTime: Infinity,
    })
)

const inFlightFetches = new Map<string, Promise<{ rows: AssetActivityData[]; queryTimeMs: number; source: AssetActivitySource }>>()
const indexedDBLoadedKeys = new Set<string>()

function makeAssetActivityKey(ticker: string, cusip?: string | null): string {
    const normalizedTicker = ticker.trim().toUpperCase()
    const normalizedCusip = cusip?.trim() || '_'
    return `${normalizedTicker}::${normalizedCusip}`
}

function getAllAssetActivityRows(): AssetActivityData[] {
    return Array.from(assetActivityCollection.entries()).map(([, value]) => value)
}

export function getAssetActivityFromCollection(ticker: string, cusip?: string | null): AssetActivityData[] {
    const assetKey = makeAssetActivityKey(ticker, cusip)
    return getAllAssetActivityRows()
        .filter((row) => row.assetKey === assetKey)
        .sort((left, right) => left.quarter.localeCompare(right.quarter))
}

export async function loadAssetActivityFromIndexedDB(ticker: string, cusip?: string | null): Promise<boolean> {
    const assetKey = makeAssetActivityKey(ticker, cusip)
    if (indexedDBLoadedKeys.has(assetKey)) {
        return getAssetActivityFromCollection(ticker, cusip).length > 0
    }

    indexedDBLoadedKeys.add(assetKey)
    const persisted = await loadPersistedAssetActivityData(assetKey)
    if (!persisted || persisted.rows.length === 0) {
        return false
    }

    const existingIds = new Set(getAllAssetActivityRows().map((row) => row.id))
    const newRows = persisted.rows.filter((row) => !existingIds.has(row.id))
    if (newRows.length > 0) {
        assetActivityCollection.utils.writeUpsert(newRows)
    }
    return true
}

export async function fetchAssetActivityData(
    ticker: string,
    cusip?: string | null
): Promise<{ rows: AssetActivityData[]; queryTimeMs: number; source: AssetActivitySource }> {
    const assetKey = makeAssetActivityKey(ticker, cusip)
    const cachedRows = getAssetActivityFromCollection(ticker, cusip)
    if (cachedRows.length > 0) {
        return { rows: cachedRows, queryTimeMs: 0, source: 'memory' }
    }

    const inFlight = inFlightFetches.get(assetKey)
    if (inFlight) {
        return inFlight
    }

    const promise = (async () => {
        const startedAt = performance.now()
        await loadAssetActivityFromIndexedDB(ticker, cusip)

        const restoredRows = getAssetActivityFromCollection(ticker, cusip)
        if (restoredRows.length > 0) {
            return {
                rows: restoredRows,
                queryTimeMs: Math.round(performance.now() - startedAt),
                source: 'indexeddb' as const,
            }
        }

        const searchParams = new URLSearchParams()
        if (cusip?.trim()) {
            searchParams.set('cusip', cusip.trim())
        } else {
            searchParams.set('ticker', ticker)
        }

        const response = await fetch(`/api/all-assets-activity?${searchParams.toString()}`)
        if (!response.ok) {
            throw new Error('Failed to fetch asset activity')
        }

        const data = await response.json() as { rows?: AssetActivityApiRow[] }
        const rows = (Array.isArray(data.rows) ? data.rows : []).map((row) => {
            const quarter = row.quarter ? String(row.quarter) : ''
            const normalizedTicker = row.ticker ? String(row.ticker) : ticker.trim().toUpperCase()
            const normalizedCusip = row.cusip ? String(row.cusip) : cusip ?? null
            return {
                id: `${assetKey}-${quarter}`,
                assetKey,
                ticker: normalizedTicker,
                cusip: normalizedCusip,
                quarter,
                numOpen: Number(row.numOpen) || 0,
                numAdd: Number(row.numAdd) || 0,
                numReduce: Number(row.numReduce) || 0,
                numClose: Number(row.numClose) || 0,
                numHold: Number(row.numHold) || 0,
                opened: Number(row.opened ?? row.numOpen) || 0,
                closed: Number(row.closed ?? row.numClose) || 0,
            }
        })

        if (rows.length > 0) {
            assetActivityCollection.utils.writeUpsert(rows)
            persistAssetActivityData(assetKey, rows).catch((error) => {
                console.warn('[AssetActivity] Failed to persist:', error)
            })
        }

        return {
            rows,
            queryTimeMs: Math.round(performance.now() - startedAt),
            source: 'api' as const,
        }
    })()

    inFlightFetches.set(assetKey, promise)
    try {
        return await promise
    } finally {
        inFlightFetches.delete(assetKey)
    }
}

export function clearAllAssetActivityData(): void {
    const ids = getAllAssetActivityRows().map((row) => row.id)
    if (ids.length > 0) {
        assetActivityCollection.utils.writeDelete(ids)
    }
    indexedDBLoadedKeys.clear()
    inFlightFetches.clear()
}
