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
    clearAssetListSessionState,
    fetchAssetRecord,
    getAssetListLoadSource,
    getLoadedAssetList,
    subscribeAssetListLoadSource,
    type AssetListLoadSource,
} from './assets'
export {
    clearSuperinvestorListSessionState,
    fetchSuperinvestorRecord,
    fetchSuperinvestorRecordWithSource,
    getLoadedSuperinvestorList,
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
export {
    loadPrecomputedIndex,
    ensureSearchIndexLoaded,
    ensureSearchItemsLoaded,
    getLoadedSearchIndex,
    getSearchIndexMetadata,
    isSearchIndexReady,
    resetSearchIndexState,
} from './searches'

// Data freshness / cache invalidation
export {
    initializeWithFreshnessCheck,
    checkDataFreshness,
    checkFreshnessOnFocus,
    invalidateAllCaches,
    clearAllIndexedDB,
} from './data-freshness'

export {
    getStoredDataVersion,
    setStoredDataVersion,
} from '@/lib/data-version'
