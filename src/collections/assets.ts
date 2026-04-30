import { createCollection } from '@tanstack/db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import type { QueryClient } from '@tanstack/query-core'
import {
    loadPersistedAssetListData as loadPersistedAssetListDataDefault,
    persistAssetListData as persistAssetListDataDefault,
    type PersistedAssetListData,
} from './query-client'

export type AssetListLoadSource = 'memory' | 'indexeddb' | 'api'

type AssetListPersistence = {
    loadPersistedAssetListData: typeof loadPersistedAssetListDataDefault
    persistAssetListData: (rows: PersistedAssetListData['rows']) => Promise<void>
}

const assetListPersistence: AssetListPersistence = {
    loadPersistedAssetListData: loadPersistedAssetListDataDefault,
    persistAssetListData: persistAssetListDataDefault,
}

export function __setAssetListPersistenceForTest(overrides: Partial<AssetListPersistence>): () => void {
    const previous = { ...assetListPersistence }
    Object.assign(assetListPersistence, overrides)
    return () => Object.assign(assetListPersistence, previous)
}

const assetListSourceListeners = new Set<(source: AssetListLoadSource) => void>()
let currentAssetListLoadSource: AssetListLoadSource = 'memory'

function setAssetListLoadSource(source: AssetListLoadSource) {
    currentAssetListLoadSource = source
    for (const listener of assetListSourceListeners) {
        listener(source)
    }
}

export function getAssetListLoadSource(): AssetListLoadSource {
    return currentAssetListLoadSource
}

export function subscribeAssetListLoadSource(listener: (source: AssetListLoadSource) => void): () => void {
    assetListSourceListeners.add(listener)
    return () => assetListSourceListeners.delete(listener)
}

export interface Asset {
    id: string
    asset: string
    assetName: string
    cusip: string | null
}

export function getLoadedAssetList(): Asset[] {
    return assetsCollection ? Array.from(assetsCollection.entries()).map(([, value]) => value as Asset) : []
}

export function clearAssetListSessionState(): void {
    const ids = getLoadedAssetList().map((row) => row.id)
    if (ids.length > 0 && assetsCollection?.isReady()) {
        assetsCollection.utils.writeDelete(ids)
    }
    currentAssetListLoadSource = 'memory'
}

export async function fetchAssetRecord(code: string, cusip?: string | null): Promise<Asset | null> {
    const encodedCode = encodeURIComponent(code)
    const encodedCusip = cusip ? `/${encodeURIComponent(cusip)}` : ''
    const response = await fetch(`/api/assets/${encodedCode}${encodedCusip}`)

    if (response.status === 404) {
        return null
    }

    if (!response.ok) {
        throw new Error('Failed to fetch asset')
    }

    return await response.json() as Asset
}

interface AssetListResponse {
    rows: Asset[]
}

async function fetchFullAssetList(): Promise<Asset[]> {
    const response = await fetch('/api/assets?limit=50000&offset=0&sort=assetName&direction=asc')
    if (!response.ok) {
        throw new Error('Failed to fetch assets')
    }

    const payload = await response.json() as AssetListResponse
    return Array.isArray(payload.rows) ? payload.rows : []
}

// Factory function to create assets collection with queryClient
// Restores from IndexedDB first, then refreshes from the DuckDB API.
const inFlightAssetListLoads = new Map<string, Promise<Asset[]>>()

export function createAssetsCollection(queryClient: QueryClient) {
    const collection = createCollection(
        queryCollectionOptions({
            queryKey: ['assets'],
            queryFn: async () => {
                const queryKey = 'assets'
                const inFlight = inFlightAssetListLoads.get(queryKey)
                if (inFlight) {
                    return inFlight
                }

                const loadPromise = (async () => {
                    const persisted = await assetListPersistence.loadPersistedAssetListData()
                    if (persisted && persisted.rows.length > 0) {
                        setAssetListLoadSource('indexeddb')
                        return persisted.rows as Asset[]
                    }

                    const startTime = performance.now()
                    const assets = await fetchFullAssetList()
                    setAssetListLoadSource('api')
                    console.log(`[Assets] Fetched ${assets.length} assets in ${Math.round(performance.now() - startTime)}ms`)
                    void assetListPersistence.persistAssetListData(assets)
                    return assets
                })()

                inFlightAssetListLoads.set(queryKey, loadPromise)
                try {
                    return await loadPromise
                } finally {
                    inFlightAssetListLoads.delete(queryKey)
                }
            },
            queryClient,
            getKey: (item) => item.id,
            syncMode: 'eager',
        })
    )

    assetsCollection = collection
    return collection
}

// Singleton instance - will be initialized in instances.ts
export let assetsCollection: ReturnType<typeof createAssetsCollection>
