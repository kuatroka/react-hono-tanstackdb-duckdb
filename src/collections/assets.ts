import { createCollection } from '@tanstack/db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import type { QueryClient } from '@tanstack/query-core'
import { loadPersistedAssetListData, persistAssetListData } from './query-client'

export type AssetListLoadSource = 'memory' | 'indexeddb' | 'api'

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
                    const persisted = await loadPersistedAssetListData()
                    if (persisted && persisted.rows.length > 0) {
                        setAssetListLoadSource('indexeddb')
                        void fetch('/api/assets')
                            .then(async (res) => {
                                if (!res.ok) throw new Error('Failed to refresh assets')
                                const assets = await res.json() as Asset[]
                                await persistAssetListData(assets)
                            })
                            .catch((error) => {
                                console.warn('[Assets] Background refresh failed:', error)
                            })

                        return persisted.rows as Asset[]
                    }

                    const startTime = performance.now()
                    const res = await fetch('/api/assets')
                    if (!res.ok) throw new Error('Failed to fetch assets')
                    const assets = await res.json() as Asset[]
                    setAssetListLoadSource('api')
                    console.log(`[Assets] Fetched ${assets.length} assets in ${Math.round(performance.now() - startTime)}ms`)
                    void persistAssetListData(assets)
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
