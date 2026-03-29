/**
 * Data Freshness - Cache Invalidation System
 *
 * Detects when backend DuckDB data is fresher than frontend caches
 * and invalidates the Dexie database when stale.
 *
 * Uses localStorage for version tracking (survives Dexie database delete).
 *
 * Key improvement over idb-keyval:
 * - Dexie properly manages connection lifecycle
 * - db.close() → db.delete() → db.open() works without page reload
 * - No stale connection issues
 */

import { invalidateDatabase } from '@/lib/dexie-db'
import { clearAllCikQuarterlyData } from './cik-quarterly'
import { clearAllAssetActivityData } from './asset-activity'
import { clearAllInvestorFlowData } from './investor-flow'
import { queryClient, clearLegacyQueryCache } from './query-client'

const STORAGE_KEY = 'app-data-version'

export interface FreshnessState {
    lastDataLoadDate: string | null
    checkedAt: number
}

export interface FreshnessCheckResult {
    isStale: boolean
    serverVersion: string | null
    localVersion: string | null
}

/**
 * Get stored data version from localStorage (sync access)
 */
export function getStoredDataVersion(): string | null {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (!stored) return null
        const state: FreshnessState = JSON.parse(stored)
        return state.lastDataLoadDate
    } catch {
        return null
    }
}

/**
 * Save data version to localStorage
 */
export function setStoredDataVersion(lastDataLoadDate: string): void {
    const state: FreshnessState = {
        lastDataLoadDate,
        checkedAt: Date.now(),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

/**
 * Invalidate all caches - Dexie database, memory caches, and TanStack Query
 *
 * Uses Dexie's proper connection lifecycle:
 * 1. Close the database connection
 * 2. Delete the database
 * 3. Reopen with fresh connection
 *
 * No page reload required!
 */
export async function invalidateAllCaches(): Promise<void> {
    console.log('[DataFreshness] Invalidating all caches...')

    // 1. Clear TanStack Query cache (in-memory)
    queryClient.clear()
    console.log('[DataFreshness] TanStack Query cache cleared')

    // 2. Clear CIK quarterly memory cache
    clearAllCikQuarterlyData()
    clearAllAssetActivityData()
    clearAllInvestorFlowData()
    console.log('[DataFreshness] Memory caches cleared')

    // 3. Invalidate Dexie database (close → delete → reopen)
    await invalidateDatabase()

    console.log('[DataFreshness] All caches invalidated')
}

/**
 * Check if backend data is fresher than our cache
 * Returns whether cache is stale and version info
 */
export async function checkDataFreshness(): Promise<FreshnessCheckResult> {
    try {
        const res = await fetch('/api/data-freshness')
        if (!res.ok) {
            console.warn('[DataFreshness] API request failed, continuing with cache')
            return { isStale: false, serverVersion: null, localVersion: getStoredDataVersion() }
        }

        const { lastDataLoadDate } = await res.json()
        const localVersion = getStoredDataVersion()

        // First load - no local version stored
        if (localVersion === null) {
            return { isStale: false, serverVersion: lastDataLoadDate, localVersion: null }
        }

        // Compare versions
        const isStale = localVersion !== lastDataLoadDate

        return { isStale, serverVersion: lastDataLoadDate, localVersion }
    } catch (error) {
        console.warn('[DataFreshness] Check failed, continuing with cache:', error)
        return { isStale: false, serverVersion: null, localVersion: getStoredDataVersion() }
    }
}

// Guard to prevent double initialization (React StrictMode runs effects twice)
let initializationPromise: Promise<boolean> | null = null
let isInitialized = false

/**
 * Initialize app with freshness check
 * Call this before preloading collections
 * Guarded against double execution from React StrictMode
 *
 * Returns true if caches were invalidated (caller should trigger preload)
 */
export async function initializeWithFreshnessCheck(): Promise<boolean> {
    // If already initialized, skip
    if (isInitialized) {
        console.log('[DataFreshness] Already initialized, skipping')
        return false
    }

    // If initialization is in progress, wait for it
    if (initializationPromise) {
        console.log('[DataFreshness] Initialization in progress, waiting...')
        return initializationPromise
    }

    initializationPromise = (async () => {
        // Drop orphaned per-query cache left by the removed persister
        clearLegacyQueryCache().catch(() => {})

        const { isStale, serverVersion, localVersion } = await checkDataFreshness()

        if (isStale && serverVersion) {
            console.log(`[DataFreshness] Data updated: ${localVersion} → ${serverVersion}, invalidating caches...`)
            await invalidateAllCaches()
            setStoredDataVersion(serverVersion)
            isInitialized = true
            // Return true to indicate caches were invalidated - caller will preload
            return true
        } else if (serverVersion && localVersion === null) {
            // First load - just store the version
            console.log(`[DataFreshness] First load, storing version: ${serverVersion}`)
            setStoredDataVersion(serverVersion)
        } else {
            console.log('[DataFreshness] Cache is fresh')
        }

        isInitialized = true
        return false
    })()

    return initializationPromise
}

// Debounce state for tab focus checks
let lastFocusCheckTime = 0
const FOCUS_CHECK_DEBOUNCE_MS = 5000

/**
 * Check freshness on tab focus (debounced)
 * Returns true if caches were invalidated (caller should trigger preload)
 */
export async function checkFreshnessOnFocus(): Promise<boolean> {
    const now = Date.now()
    if (now - lastFocusCheckTime < FOCUS_CHECK_DEBOUNCE_MS) {
        return false
    }
    lastFocusCheckTime = now

    const { isStale, serverVersion } = await checkDataFreshness()

    if (isStale && serverVersion) {
        console.log(`[DataFreshness] Tab focus: data updated, invalidating caches...`)
        await invalidateAllCaches()
        setStoredDataVersion(serverVersion)
        // Return true - caller will trigger preload
        return true
    }

    return false
}

// Legacy export for backward compatibility (now uses Dexie internally)
export async function clearAllIndexedDB(): Promise<void> {
    await invalidateDatabase()
}
