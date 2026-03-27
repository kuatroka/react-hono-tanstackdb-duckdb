import { createCollection } from '@tanstack/db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import { queryClient } from './query-client'
import {
    loadPersistedInvestorFlowData,
    persistInvestorFlowData,
} from './query-client'

export interface InvestorFlowData {
    id: string
    ticker: string
    quarter: string
    inflow: number
    outflow: number
}

type InvestorFlowSource = 'memory' | 'indexeddb' | 'api'

interface InvestorFlowApiRow {
    quarter?: string | null
    inflow?: number | null
    outflow?: number | null
}

export const investorFlowCollection = createCollection(
    queryCollectionOptions<InvestorFlowData>({
        queryKey: ['investor-flow-local'],
        queryFn: async () => [],
        queryClient,
        getKey: (item) => item.id,
        enabled: false,
        staleTime: Infinity,
    })
)

const inFlightFetches = new Map<string, Promise<{ rows: InvestorFlowData[]; queryTimeMs: number; source: InvestorFlowSource }>>()
const indexedDBLoadedTickers = new Set<string>()

function normalizeTicker(ticker: string): string {
    return ticker.trim().toUpperCase()
}

function getAllInvestorFlowRows(): InvestorFlowData[] {
    return Array.from(investorFlowCollection.entries()).map(([, value]) => value)
}

export function getInvestorFlowFromCollection(ticker: string): InvestorFlowData[] {
    const normalizedTicker = normalizeTicker(ticker)
    return getAllInvestorFlowRows()
        .filter((row) => row.ticker === normalizedTicker)
        .sort((left, right) => left.quarter.localeCompare(right.quarter))
}

export async function loadInvestorFlowFromIndexedDB(ticker: string): Promise<boolean> {
    const normalizedTicker = normalizeTicker(ticker)
    if (indexedDBLoadedTickers.has(normalizedTicker)) {
        return getInvestorFlowFromCollection(normalizedTicker).length > 0
    }

    indexedDBLoadedTickers.add(normalizedTicker)
    const persisted = await loadPersistedInvestorFlowData(normalizedTicker)
    if (!persisted || persisted.rows.length === 0) {
        return false
    }

    const existingIds = new Set(getAllInvestorFlowRows().map((row) => row.id))
    const newRows = persisted.rows.filter((row) => !existingIds.has(row.id))
    if (newRows.length > 0) {
        investorFlowCollection.utils.writeUpsert(newRows)
    }
    return true
}

export async function fetchInvestorFlowData(
    ticker: string
): Promise<{ rows: InvestorFlowData[]; queryTimeMs: number; source: InvestorFlowSource }> {
    const normalizedTicker = normalizeTicker(ticker)
    const cachedRows = getInvestorFlowFromCollection(normalizedTicker)
    if (cachedRows.length > 0) {
        return { rows: cachedRows, queryTimeMs: 0, source: 'memory' }
    }

    const inFlight = inFlightFetches.get(normalizedTicker)
    if (inFlight) {
        return inFlight
    }

    const promise = (async () => {
        const startedAt = performance.now()
        await loadInvestorFlowFromIndexedDB(normalizedTicker)

        const restoredRows = getInvestorFlowFromCollection(normalizedTicker)
        if (restoredRows.length > 0) {
            return {
                rows: restoredRows,
                queryTimeMs: Math.round(performance.now() - startedAt),
                source: 'indexeddb' as const,
            }
        }

        const response = await fetch(`/api/investor-flow?ticker=${encodeURIComponent(normalizedTicker)}`)
        if (!response.ok) {
            throw new Error('Failed to fetch investor flow')
        }

        const data = await response.json() as { rows?: InvestorFlowApiRow[] }
        const rows = (Array.isArray(data.rows) ? data.rows : []).map((row) => ({
            id: `${normalizedTicker}-${row.quarter ? String(row.quarter) : ''}`,
            ticker: normalizedTicker,
            quarter: row.quarter ? String(row.quarter) : '',
            inflow: Number(row.inflow) || 0,
            outflow: Number(row.outflow) || 0,
        }))

        if (rows.length > 0) {
            investorFlowCollection.utils.writeUpsert(rows)
            persistInvestorFlowData(normalizedTicker, rows).catch((error) => {
                console.warn('[InvestorFlow] Failed to persist:', error)
            })
        }

        return {
            rows,
            queryTimeMs: Math.round(performance.now() - startedAt),
            source: 'api' as const,
        }
    })()

    inFlightFetches.set(normalizedTicker, promise)
    try {
        return await promise
    } finally {
        inFlightFetches.delete(normalizedTicker)
    }
}

export function clearAllInvestorFlowData(): void {
    const ids = getAllInvestorFlowRows().map((row) => row.id)
    if (ids.length > 0) {
        investorFlowCollection.utils.writeDelete(ids)
    }
    indexedDBLoadedTickers.clear()
    inFlightFetches.clear()
}
