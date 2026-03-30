import { Zero } from "@rocicorp/zero";
import { Schema } from "./schema";
import { queries } from "./zero/queries";

// Preload configuration
export const PRELOAD_TTL = "5m";
export const PRELOAD_LIMITS = {
  assetsTable: 500,
  superinvestorsTable: 500,
  searchAssets: 500,      // Global search: assets category
  searchSuperinvestors: 100, // Global search: superinvestors category
} as const;

/**
 * Preload strategy inspired by ztunes:
 * - Preload windowed page data for instant browsing
 * - Preload search index (`searches` table) for instant local search
 * - Use 5-minute TTL for instant re-navigation
 *
 * Note: searchesByCategory serves both global search and per-table search.
 * No separate searchesByName preload needed – global search queries against
 * the same cached `searches` rows.
 */
export function preload(z: Zero<Schema>) {
  // Preload the initial virtualized table windows
  z.preload(
    queries.assetsVirtualPage(PRELOAD_LIMITS.assetsTable, null, "forward", {
      search: "",
      sortColumn: "assetName",
      sortDirection: "asc",
    }),
    { ttl: PRELOAD_TTL }
  );
  z.preload(
    queries.superinvestorsVirtualPage(PRELOAD_LIMITS.superinvestorsTable, null, "forward", {
      search: "",
      sortColumn: "cikName",
      sortDirection: "asc",
    }),
    { ttl: PRELOAD_TTL }
  );

  // Preload search index for instant local search (serves both global and per-table search)
  // Sorted alphabetically so local results are a valid prefix of full results
  z.preload(queries.searchesByCategory("assets", "", PRELOAD_LIMITS.searchAssets), { ttl: PRELOAD_TTL });
  z.preload(queries.searchesByCategory("superinvestors", "", PRELOAD_LIMITS.searchSuperinvestors), { ttl: PRELOAD_TTL });

  // Other reference data
  z.preload(queries.listUsers(), { ttl: PRELOAD_TTL });
  z.preload(queries.listMediums(), { ttl: PRELOAD_TTL });
}

