# Manual Test Script: Zero Cache Fix Verification

## Quick Test (2 minutes)

### Setup
1. Open browser to your running app (check console output for URL, usually http://localhost:5173)
2. Open DevTools (F12 or Cmd+Option+I)
3. Go to Network tab
4. Filter by "get-queries"

### Test: Verify Repeat Navigation Uses Cache

**Step 1: First visit (cold)**
1. In the app, open Global Search (click search box)
2. Type: `NIO`
3. Click the NIO result
4. **Observe:**
   - Latency badge in top-right shows ~400-500ms
   - Network tab shows `/api/zero/get-queries` requests (2-4 requests)
   - Note the exact latency value: _______ ms

**Step 2: Second visit (should be warm - THE FIX)**
1. Click "Back to assets" link
2. Open Global Search again
3. Type: `NIO`
4. Click the NIO result again
5. **Observe:**
   - ✅ Latency badge should show ~0-20ms (NOT ~480ms)
   - ✅ Network tab should show NO new `get-queries` requests
   - Note the exact latency value: _______ ms

**Step 3: Cross-asset test**
1. Back to search
2. Type: `XPEV`
3. Click XPEV (first time - cold)
4. Note latency: _______ ms
5. Back to search
6. Click XPEV again (second time - should be warm)
7. ✅ Latency should be ~0-20ms: _______ ms
8. Back to search
9. Click NIO again (should still be cached)
10. ✅ Latency should be ~0-20ms: _______ ms

### Expected Results

| Navigation | Expected Latency | Expected Network Calls |
|------------|------------------|------------------------|
| NIO (1st)  | ~400-500ms      | 2-4 get-queries        |
| NIO (2nd)  | ~0-20ms ✅      | 0 get-queries ✅       |
| XPEV (1st) | ~400-500ms      | 2-4 get-queries        |
| XPEV (2nd) | ~0-20ms ✅      | 0 get-queries ✅       |
| NIO (3rd)  | ~0-20ms ✅      | 0 get-queries ✅       |

### If Test Fails

**If latency is still high on repeat visits:**
- Check that you're testing within 5 minutes (TTL expires after 5min)
- Hard refresh the page (Cmd+Shift+R) to clear any old code
- Check browser console for errors
- Verify the changes were saved (check `src/pages/AssetDetail.tsx` line 22 has `ttl: PRELOAD_TTL`)

**If you see get-queries on repeat visits:**
- The fix didn't apply - check the code changes
- Clear browser cache completely
- Restart dev server

## Detailed Test (5 minutes)

### Test 1: Preload on Hover
1. Open Global Search
2. Type: `TSLA`
3. **Hover** over TSLA result (don't click)
4. Watch Network tab - should see get-queries start
5. Wait 2 seconds
6. Click TSLA
7. ✅ Latency should be very low (~10-50ms) because preload happened

### Test 2: TTL Expiration
1. Navigate to any asset
2. Wait 6+ minutes
3. Navigate to same asset again
4. ✅ Should see ~400-500ms latency (cache expired, revalidated)

### Test 3: Multiple Assets in Cache
1. Visit: NIO → XPEV → TSLA → AAPL (all first time)
2. Then visit: NIO → XPEV → TSLA → AAPL (all second time)
3. ✅ All second visits should be ~0-20ms

## Success Criteria

✅ **PASS:** Repeat navigation shows <20ms latency
✅ **PASS:** Network tab shows 0 get-queries on warm path
✅ **PASS:** Multiple assets can be cached simultaneously
✅ **PASS:** Cache expires after 5 minutes

❌ **FAIL:** Latency still ~480ms on repeat visits
❌ **FAIL:** Network shows get-queries every time

## Quick Visual Check

Before fix:
```
NIO (1st): 480ms → Back → NIO (2nd): 480ms ❌ (always slow)
```

After fix:
```
NIO (1st): 480ms → Back → NIO (2nd): 5ms ✅ (instant!)
```

## Files Changed
- ✅ `src/pages/AssetDetail.tsx` - Added TTL to 4 queries
- ✅ `src/pages/SuperinvestorDetail.tsx` - Added TTL to 1 query
- ✅ `src/components/GlobalSearch.tsx` - Added preloading on hover

## Report Results

After testing, report:
1. First visit latency: _______ ms
2. Second visit latency: _______ ms
3. Network calls on second visit: _______ (should be 0)
4. Test result: PASS / FAIL

If FAIL, provide:
- Screenshot of Network tab on second visit
- Screenshot of latency badge on second visit
- Browser console errors (if any)
