import { createCollection } from '@tanstack/db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import type { QueryClient } from '@tanstack/query-core'

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
// Uses 'progressive' sync mode: loads query subset first, syncs full dataset in background
// Best for ~40K rows - instant first paint + sub-millisecond queries after sync
export function createAssetsCollection(queryClient: QueryClient) {
    return createCollection(
        queryCollectionOptions({
            queryKey: ['assets'],
            queryFn: async () => {
                const startTime = performance.now()
                const res = await fetch('/api/assets')
                if (!res.ok) throw new Error('Failed to fetch assets')
                const assets = await res.json() as Asset[]
                console.log(`[Assets] Fetched ${assets.length} assets in ${Math.round(performance.now() - startTime)}ms`)
                return assets
            },
            queryClient,
            getKey: (item) => item.id,
            syncMode: 'eager', // Load all ~40K assets upfront for instant queries
        })
    )
}

// Singleton instance - will be initialized in instances.ts
export let assetsCollection: ReturnType<typeof createAssetsCollection>
