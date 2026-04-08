import { createCollection } from '@tanstack/db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import type { QueryClient } from '@tanstack/query-core'

export interface Superinvestor {
    id: string
    cik: string
    cikName: string
}

export async function fetchSuperinvestorRecord(cik: string): Promise<Superinvestor | null> {
    const response = await fetch(`/api/superinvestors/${encodeURIComponent(cik)}`)

    if (response.status === 404) {
        return null
    }

    if (!response.ok) {
        throw new Error('Failed to fetch superinvestor')
    }

    return await response.json() as Superinvestor
}

// Factory function to create superinvestors collection with queryClient
// Uses 'eager' sync mode: loads entire collection upfront
// Best for ~15K rows - well under the 50K threshold for on-demand
export function createSuperinvestorsCollection(queryClient: QueryClient) {
    return createCollection(
        queryCollectionOptions({
            queryKey: ['superinvestors'],
            queryFn: async () => {
                const startTime = performance.now()
                const res = await fetch('/api/superinvestors')
                if (!res.ok) throw new Error('Failed to fetch superinvestors')
                const superinvestors = await res.json() as Superinvestor[]
                console.log(`[Superinvestors] Fetched ${superinvestors.length} superinvestors in ${Math.round(performance.now() - startTime)}ms`)
                return superinvestors
            },
            queryClient,
            getKey: (item) => item.cik,
            syncMode: 'eager', // Load all ~15K superinvestors upfront
        })
    )
}

// Singleton instance - will be initialized in instances.ts
export let superinvestorsCollection: ReturnType<typeof createSuperinvestorsCollection>
