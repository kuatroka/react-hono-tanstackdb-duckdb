import { createCollection } from '@tanstack/db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import type { QueryClient } from '@tanstack/query-core'
import type { AllAssetsActivityResponse, AllAssetsActivityRow } from '@/types/duckdb'

export const allAssetsActivityTiming = {
    lastFetchStartedAt: null as number | null,
    lastFetchEndedAt: null as number | null,
    lastApiQueryTimeMs: null as number | null,
}

export function createAllAssetsActivityCollection(queryClient: QueryClient) {
    return createCollection(
        queryCollectionOptions({
            queryKey: ['all-assets-activity'],
            queryFn: async () => {
                allAssetsActivityTiming.lastFetchStartedAt = performance.now()
                const res = await fetch('/api/all-assets-activity')
                if (!res.ok) throw new Error('Failed to fetch all assets activity')
                const data = (await res.json()) as AllAssetsActivityResponse
                allAssetsActivityTiming.lastApiQueryTimeMs = data.queryTimeMs
                allAssetsActivityTiming.lastFetchEndedAt = performance.now()
                return data.rows as AllAssetsActivityRow[]
            },
            queryClient,
            getKey: (item) => item.id,
            syncMode: 'eager',
        })
    )
}

export let allAssetsActivityCollection: ReturnType<typeof createAllAssetsActivityCollection>
