# Zero Cache Fix Verification Guide

## Problem Statement
Detail pages (AssetDetail, SuperinvestorDetail) were experiencing high latency (~480ms) on **every navigation**, even when visiting the same asset multiple times (e.g., NIO → back → NIO). This was because queries lacked TTL configuration, forcing Zero to always revalidate with the server.

## Root Cause
The detail page queries were missing the `ttl` option in their `useQuery` calls:
- `assetBySymbolAndCusip` / `assetBySymbol`
- `investorActivityByCusip` / `investorActivityByTicker`
- `superinvestorByCik`

Without TTL, Zero's default behavior is to **always revalidate** on component mount, meaning:
- Every navigation triggers a new `/api/zero/get-queries` request
- Postgres/sync DB gets queried every time
- Local cache exists but is never trusted as "fresh enough"
- Latency stays consistently high (~480ms) even for repeated visits

## Changes Made

### 1. Added TTL to AssetDetail queries
**File:** `src/pages/AssetDetail.tsx`

```typescript
// Before: No TTL
const [rowsBySymbolAndCusip, resultBySymbolAndCusip] = useQuery(
  queries.assetBySymbolAndCusip(code || '', cusip || ''),
  { enabled: Boolean(code) && Boolean(hasCusip) }
);

// After: 5-minute TTL
const [rowsBySymbolAndCusip, resultBySymbolAndCusip] = useQuery(
  queries.assetBySymbolAndCusip(code || '', cusip || ''),
  { enabled: Boolean(code) && Boolean(hasCusip), ttl: PRELOAD_TTL }
);
```

All 4 queries in AssetDetail now have `ttl: PRELOAD_TTL` (5 minutes):
- `assetBySymbolAndCusip`
- `assetBySymbol`
- `investorActivityByCusip`
- `investorActivityByTicker`

### 2. Added TTL to SuperinvestorDetail query
**File:** `src/pages/SuperinvestorDetail.tsx`

```typescript
// Before: No TTL
const [rows, result] = useQuery(
  queries.superinvestorByCik(cik || ''),
  { enabled: Boolean(cik) }
);

// After: 5-minute TTL
const [rows, result] = useQuery(
  queries.superinvestorByCik(cik || ''),
  { enabled: Boolean(cik), ttl: PRELOAD_TTL }
);
```

### 3. Added preloading from GlobalSearch
**File:** `src/components/GlobalSearch.tsx`

Added hover preloading on search results to warm the cache **before** navigation:

```typescript
onMouseEnter={() => {
  setHighlightedIndex(index);
  // Preload detail queries to warm cache before navigation
  if (result.category === "assets") {
    if (result.cusip) {
      z.preload(queries.assetBySymbolAndCusip(result.code, result.cusip), { ttl: PRELOAD_TTL });
      z.preload(queries.investorActivityByCusip(result.cusip), { ttl: PRELOAD_TTL });
    } else {
      z.preload(queries.assetBySymbol(result.code), { ttl: PRELOAD_TTL });
      z.preload(queries.investorActivityByTicker(result.code), { ttl: PRELOAD_TTL });
    }
  } else if (result.category === "superinvestors") {
    z.preload(queries.superinvestorByCik(result.code), { ttl: PRELOAD_TTL });
  }
}}
```

## Expected Behavior After Fix

### First Visit (Cold Path)
1. Open GlobalSearch, type "NIO"
2. Hover over NIO result → preload starts in background
3. Click NIO → navigate to `/assets/NIO/62914V106`
4. **First time:** Latency badge shows ~400-500ms (server query)
5. Network tab shows `/api/zero/get-queries` requests

### Second Visit (Warm Path - THE FIX)
1. Navigate back to search or assets table
2. Click NIO again within 5 minutes
3. **Second time:** Latency badge shows ~0-10ms (local cache)
4. **Network tab shows NO new `/api/zero/get-queries` requests** for those queries
5. Data loads instantly from IndexedDB/local SQLite

### Repeat Navigation Test
Navigate: NIO → XPEV → NIO → XPEV (all within 5 minutes)
- **First NIO:** ~480ms (cold)
- **First XPEV:** ~480ms (cold)
- **Second NIO:** ~5ms (warm) ✅
- **Second XPEV:** ~5ms (warm) ✅

## Manual Verification Steps

### Prerequisites
1. Start dev server: `bun run dev`
2. Open browser to `http://localhost:5173` (or whatever port Vite uses)
3. Open DevTools → Network tab
4. Filter by "get-queries" to see Zero API calls

### Test 1: Verify TTL Works for Repeated Navigation
1. **Clear browser cache** (hard refresh: Cmd+Shift+R)
2. Open GlobalSearch, search for "NIO"
3. Click NIO result → note latency badge value (~400-500ms expected)
4. In Network tab, note the `/api/zero/get-queries` requests
5. Click "Back to assets" link
6. Search for "NIO" again and click it
7. **Expected:**
   - Latency badge: ~0-10ms (not ~480ms)
   - Network tab: NO new `get-queries` requests for `assets.bySymbolAndCusip` or `investorActivity.byCusip`

### Test 2: Verify Preloading from GlobalSearch
1. **Clear browser cache**
2. Open GlobalSearch, type "XPEV"
3. **Hover** over XPEV result (don't click yet)
4. Watch Network tab → should see `get-queries` requests start
5. Wait 1-2 seconds (let preload complete)
6. Click XPEV
7. **Expected:**
   - Latency badge shows very low value (~10-50ms) because data was preloaded
   - Detail page renders almost instantly

### Test 3: Verify TTL Expiration
1. Navigate to an asset (e.g., NIO)
2. Wait **6+ minutes** (longer than 5-minute TTL)
3. Navigate back and click NIO again
4. **Expected:**
   - Latency badge shows ~400-500ms again (cache expired, server query)
   - Network tab shows new `get-queries` requests

### Test 4: Cross-Asset Navigation
1. Search "NIO" → click → note latency
2. Back → search "XPEV" → click → note latency
3. Back → search "NIO" → click → **should be instant (~5ms)**
4. Back → search "XPEV" → click → **should be instant (~5ms)**
5. **Expected:** Both assets cached independently, both warm on second visit

## Debugging Tips

### If latency is still high on repeat visits:
1. Check browser DevTools → Application → IndexedDB → verify Zero database exists
2. Check Network tab → filter "get-queries" → should see NO requests on warm path
3. Check console for Zero errors or warnings
4. Verify `PRELOAD_TTL` is imported correctly in detail pages
5. Hard refresh (Cmd+Shift+R) to clear any stale state

### If preloading from search doesn't work:
1. Check console for errors when hovering search results
2. Verify `useZero` hook is called in GlobalSearch component
3. Check Network tab → preload should trigger `get-queries` on hover
4. Ensure hover handler is actually firing (add console.log temporarily)

## Performance Metrics

### Before Fix
- **First visit:** ~480ms (cold path)
- **Repeat visit:** ~480ms (still cold - BUG)
- **User experience:** Every navigation feels slow

### After Fix
- **First visit:** ~480ms (cold path - expected)
- **Repeat visit (within 5min):** ~5-10ms (warm path)
- **With preload:** ~10-50ms (preloaded on hover)
- **User experience:** Instant navigation after first visit

## Technical Details

### Why TTL Matters
Zero's local cache (IndexedDB/SQLite) stores query results, but without TTL:
- Zero doesn't know how long to trust the cached data
- Default behavior: always revalidate with server
- With TTL: Zero trusts cache for specified duration (5 minutes)

### Why Preloading Helps
- Preload on hover starts server query before user clicks
- By the time navigation happens, data is already in cache
- Turns "cold" first visit into "warm" experience
- Especially effective for search → detail navigation

### Cache Layers
1. **Postgres (upstream):** Source of truth
2. **Zero sync DB:** Server-side SQLite, executes queries
3. **Client cache (IndexedDB):** Local storage, instant access
4. **TTL:** Controls when to skip server and use local cache

## Related Files
- `src/pages/AssetDetail.tsx` - Asset detail queries with TTL
- `src/pages/SuperinvestorDetail.tsx` - Superinvestor detail query with TTL
- `src/components/GlobalSearch.tsx` - Search result preloading
- `src/zero-preload.ts` - TTL constant definition (`PRELOAD_TTL = "5m"`)
- `docs/ZERO-PERFORMANCE-PATTERNS.md` - Performance best practices

## Success Criteria
✅ Repeat navigation to same asset shows <20ms latency
✅ Network tab shows no `get-queries` on warm path
✅ Hover preload triggers background queries
✅ Cache expires after 5 minutes (revalidates)
✅ Multiple assets can be cached simultaneously
