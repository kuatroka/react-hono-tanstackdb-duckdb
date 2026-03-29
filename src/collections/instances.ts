/**
 * TanStack DB Collection Instances
 * 
 * Singleton collection instances imported by components for useLiveQuery.
 * Collections fetch fresh from the DuckDB API on every page load (~60 ms).
 * Route-specific data uses dedicated Dexie tables for persistence.
 */

import { queryClient } from './query-client';
import { createAssetsCollection, type Asset } from './assets';
import { createSuperinvestorsCollection, type Superinvestor } from './superinvestors';
import { createAllAssetsActivityCollection } from './all-assets-activity';
import { searchesCollection, preloadSearches, type SearchResult } from './searches';
import { type InvestorDetail } from './investor-details';

// Re-export queryClient for external use
export { queryClient };

// Create collection instances with the shared queryClient
export const assetsCollection = createAssetsCollection(queryClient);
export const superinvestorsCollection = createSuperinvestorsCollection(queryClient);
export const allAssetsActivityCollection = createAllAssetsActivityCollection(queryClient);

// Re-export searches collection
export { searchesCollection, preloadSearches };

// Re-export types for convenience
export type { Asset, Superinvestor, SearchResult, InvestorDetail };

// Preload collections - triggers fresh API fetch on every page load
export async function preloadCollections(): Promise<void> {
    const startTime = performance.now();
    console.log('[Collections] Preloading...');
    
    await Promise.all([
        assetsCollection.preload(),
        superinvestorsCollection.preload(),
        allAssetsActivityCollection.preload(),
    ]);
    
    console.log(`[Collections] Preloaded in ${Math.round(performance.now() - startTime)}ms`);
}
