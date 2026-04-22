import { createCollection } from '@tanstack/db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import { queryClient } from './query-client'

export interface SuperinvestorAssetHistoryRow {
  id: string
  ticker: string
  cusip: string
  cik: string
  quarter: string
  reportWindowComplete: boolean
  action: string
  sharesCurrentAdj: number
  positionValue: number
  transactionShares: number | null
  transactionValue: number | null
  holdingDurationQuarters: number | null
}

type SuperinvestorAssetHistorySource = 'memory' | 'api'

interface SuperinvestorAssetHistoryApiRow {
  quarter?: string | null
  reportWindowComplete?: boolean | null
  action?: string | null
  sharesCurrentAdj?: number | null
  positionValue?: number | null
  transactionShares?: number | null
  transactionValue?: number | null
  holdingDurationQuarters?: number | null
}

export const superinvestorAssetHistoryCollection = createCollection(
  queryCollectionOptions<SuperinvestorAssetHistoryRow>({
    queryKey: ['superinvestor-asset-history-local'],
    queryFn: async () => [],
    queryClient,
    getKey: (item) => item.id,
    enabled: false,
    staleTime: Infinity,
  })
)

const inFlightFetches = new Map<string, Promise<{ rows: SuperinvestorAssetHistoryRow[]; queryTimeMs: number; source: SuperinvestorAssetHistorySource }>>()
const bufferedRows = new Map<string, SuperinvestorAssetHistoryRow>()

function isSyncNotInitializedError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('SyncNotInitializedError')
}

function flushBufferedRowsIfReady(): void {
  if (bufferedRows.size === 0 || !superinvestorAssetHistoryCollection.isReady()) {
    return
  }

  const rows = Array.from(bufferedRows.values())
  try {
    superinvestorAssetHistoryCollection.utils.writeUpsert(rows)
    bufferedRows.clear()
  } catch (error) {
    if (!isSyncNotInitializedError(error)) {
      throw error
    }
  }
}

function safeWriteUpsert(rows: SuperinvestorAssetHistoryRow[]): void {
  if (rows.length === 0) {
    return
  }

  if (superinvestorAssetHistoryCollection.isReady()) {
    try {
      superinvestorAssetHistoryCollection.utils.writeUpsert(rows)
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

  if (!superinvestorAssetHistoryCollection.isReady()) {
    return
  }

  try {
    superinvestorAssetHistoryCollection.utils.writeDelete(ids)
  } catch (error) {
    if (!isSyncNotInitializedError(error)) {
      throw error
    }
  }
}

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase()
}

function makeHistoryKey(ticker: string, cusip: string, cik: string): string {
  return `${normalizeTicker(ticker)}:${cusip}:${cik}`
}

function getAllRows(): SuperinvestorAssetHistoryRow[] {
  flushBufferedRowsIfReady()

  const merged = new Map<string, SuperinvestorAssetHistoryRow>()
  for (const [id, value] of superinvestorAssetHistoryCollection.entries()) {
    merged.set(id, value)
  }
  for (const [id, value] of bufferedRows.entries()) {
    merged.set(id, value)
  }
  return Array.from(merged.values())
}

function mapHistoryRows(
  ticker: string,
  cusip: string,
  cik: string,
  sourceRows: SuperinvestorAssetHistoryApiRow[],
): SuperinvestorAssetHistoryRow[] {
  const normalizedTicker = normalizeTicker(ticker)
  return sourceRows.map((row) => {
    const quarter = String(row.quarter ?? '')
    return {
      id: `${normalizedTicker}:${cusip}:${cik}:${quarter}`,
      ticker: normalizedTicker,
      cusip,
      cik,
      quarter,
      reportWindowComplete: Boolean(row.reportWindowComplete),
      action: String(row.action ?? 'hold'),
      sharesCurrentAdj: Number(row.sharesCurrentAdj) || 0,
      positionValue: Number(row.positionValue) || 0,
      transactionShares: row.transactionShares != null ? Number(row.transactionShares) : null,
      transactionValue: row.transactionValue != null ? Number(row.transactionValue) : null,
      holdingDurationQuarters: row.holdingDurationQuarters != null ? Number(row.holdingDurationQuarters) : null,
    }
  })
}

export function getSuperinvestorAssetHistoryFromCollection(
  ticker: string,
  cusip: string,
  cik: string,
): SuperinvestorAssetHistoryRow[] {
  const normalizedTicker = normalizeTicker(ticker)
  return getAllRows()
    .filter((row) => row.ticker === normalizedTicker && row.cusip === cusip && row.cik === cik)
    .sort((left, right) => left.quarter.localeCompare(right.quarter))
}

export async function fetchSuperinvestorAssetHistoryData(
  ticker: string,
  cusip: string,
  cik: string,
): Promise<{ rows: SuperinvestorAssetHistoryRow[]; queryTimeMs: number; source: SuperinvestorAssetHistorySource }> {
  const normalizedTicker = normalizeTicker(ticker)
  const cacheKey = makeHistoryKey(normalizedTicker, cusip, cik)
  const cachedRows = getSuperinvestorAssetHistoryFromCollection(normalizedTicker, cusip, cik)
  if (cachedRows.length > 0) {
    return { rows: cachedRows, queryTimeMs: 0, source: 'memory' }
  }

  const inFlight = inFlightFetches.get(cacheKey)
  if (inFlight) {
    return inFlight
  }

  const promise = (async () => {
    const startedAt = performance.now()
    const searchParams = new URLSearchParams()
    searchParams.set('ticker', normalizedTicker)
    searchParams.set('cusip', cusip)
    searchParams.set('cik', cik)

    const response = await fetch(`/api/superinvestor-asset-history?${searchParams.toString()}`)
    if (!response.ok) {
      throw new Error('Failed to fetch superinvestor asset history')
    }

    const data = await response.json() as { rows?: SuperinvestorAssetHistoryApiRow[] }
    const rows = mapHistoryRows(normalizedTicker, cusip, cik, Array.isArray(data.rows) ? data.rows : [])

    if (rows.length > 0) {
      safeWriteUpsert(rows)
    }

    return {
      rows,
      queryTimeMs: Math.round(performance.now() - startedAt),
      source: 'api' as const,
    }
  })()

  inFlightFetches.set(cacheKey, promise)
  try {
    return await promise
  } finally {
    inFlightFetches.delete(cacheKey)
  }
}

export function clearAllSuperinvestorAssetHistoryData(): void {
  const ids = getAllRows().map((row) => row.id)
  if (ids.length > 0) {
    safeWriteDelete(ids)
  }
  bufferedRows.clear()
  inFlightFetches.clear()
}
