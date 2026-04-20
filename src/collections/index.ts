// TanStack DB Collections - Export all collection instances and types

// Singleton instances (for use with useLiveQuery in components)
export {
    queryClient,
    assetsCollection,
    superinvestorsCollection,
    allAssetsActivityCollection,
    searchesCollection,
    preloadCollections,
    preloadSearches,
} from './instances'

// Types
export type { Asset, Superinvestor, SearchResult } from './instances'
export {
    fetchAssetRecord,
    getAssetListLoadSource,
    subscribeAssetListLoadSource,
    type AssetListLoadSource,
} from './assets'
export {
    fetchSuperinvestorRecord,
    fetchSuperinvestorRecordWithSource,
    getSuperinvestorListLoadSource,
    subscribeSuperinvestorListLoadSource,
    type SuperinvestorListLoadSource,
} from './superinvestors'
export {
    type InvestorDetail,
    investorDrilldownCollection,
    fetchDrilldownBothActions,
    backgroundLoadAllDrilldownData,
    getDrilldownDataFromCollection,
    loadDrilldownFromIndexedDB,
    isDrilldownIndexedDBLoaded,
    clearAllDrilldownData,
} from './investor-details'
export {
    type AssetActivityData,
    assetActivityCollection,
    fetchAssetActivityData,
    getAssetActivityFromCollection,
    loadAssetActivityFromIndexedDB,
    clearAllAssetActivityData,
} from './asset-activity'
export {
    type InvestorFlowData,
    investorFlowCollection,
    fetchInvestorFlowData,
    getInvestorFlowFromCollection,
    loadInvestorFlowFromIndexedDB,
    clearAllInvestorFlowData,
} from './investor-flow'
export {
    type CikQuarterlyData,
    cikQuarterlyCollection,
    fetchCikQuarterlyData,
    getCikQuarterlyDataFromCache,
    hasFetchedCikData,
    cikQuarterlyTiming,
    prefetchCikQuarterlyData,
    invalidateCikQuarterlyData,
} from './cik-quarterly'

// Search data loading helpers
export { loadPrecomputedIndex, ensureSearchItemsLoaded, getSearchIndexMetadata, isSearchIndexReady } from './searches'

// Data freshness / cache invalidation
export {
    initializeWithFreshnessCheck,
    checkDataFreshness,
    checkFreshnessOnFocus,
    invalidateAllCaches,
    clearAllIndexedDB,
    getStoredDataVersion,
    setStoredDataVersion,
} from './data-freshness'
