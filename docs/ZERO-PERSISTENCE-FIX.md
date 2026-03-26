# Zero Persistence Fix

## Problem
Zero was losing all local data on page refresh, causing full page reloads and empty tables.

## Root Causes Fixed

### 1. ❌ Replica File in `/tmp` (FIXED ✅)
**Problem:** The replica file was stored in `/tmp/hello_zero_replica.db`, which can be cleared by the OS.

**Fix:** Moved to `./.zero-data/hello_zero_replica.db` (persistent location)

```env
# Before
ZERO_REPLICA_FILE="/tmp/hello_zero_replica.db"

# After
ZERO_REPLICA_FILE="./.zero-data/hello_zero_replica.db"
```

### 2. ❌ Missing `cik_directory` Table (FIXED ✅)
**Problem:** Schema referenced a table that didn't exist in PostgreSQL, causing Zero to crash.

**Fix:** Removed `cik_directory` from schema.ts

### 3. ❌ Unstable Anonymous User ID (FIXED ✅)
**Problem:** Anonymous users got a new ID on each refresh, preventing cache reuse.

**Fix:** Added stable anonymous user ID stored in localStorage:

```typescript
function getStableUserID(): string {
  // If logged in, use JWT sub
  if (decodedJWT?.sub) return decodedJWT.sub;

  // For anonymous users, persist ID in localStorage
  let anonID = localStorage.getItem("zero_anon_user_id");
  if (!anonID) {
    anonID = `anon_${crypto.randomUUID()}`;
    localStorage.setItem("zero_anon_user_id", anonID);
  }
  return anonID;
}
```

### 4. ❌ IndexedDB Not Persisted (FIXED ✅)
**Problem:** Browser might clear IndexedDB without persistent storage permission.

**Fix:** Request persistent storage on app load:

```typescript
async function requestPersistentStorage() {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persisted();
    if (!isPersisted) {
      await navigator.storage.persist();
    }
  }
}
```

### 5. ✅ Performance Indexes Added
**Bonus:** Added indexes to speed up queries on large tables (40,000+ rows):

```sql
CREATE INDEX idx_superinvestors_cik_name ON superinvestors(cik_name, id);
CREATE INDEX idx_assets_asset_name ON assets(asset_name, id);
-- ... and more
```

## How to Test

### Step 1: Restart Your Dev Server

```bash
# Stop current server (Ctrl+C)

# Start fresh
bun run dev
```

### Step 2: Verify Zero Starts Successfully

Look for these logs (no errors):

```
[zero] Running zero-cache at http://localhost:4848
[zero] Permissions unchanged (hash=...)
```

### Step 3: Test Data Persistence

1. **Open the app:** http://localhost:3003/
2. **Add some messages** using the "Add Messages" button
3. **Open DevTools → Console** and check for:
   ```
   [Zero] Storage is already persistent
   ```
   or
   ```
   [Zero] Persistent storage granted
   ```
4. **Check IndexedDB:**
   - DevTools → Application → IndexedDB
   - You should see a Zero database with data
5. **Refresh the page (F5 or Cmd+R)**
6. **Verify:**
   - ✅ Messages appear instantly (no loading)
   - ✅ IndexedDB still has data
   - ✅ No "Slow SQLite query" warnings in terminal

### Step 4: Test Superinvestors Page

**Note:** The superinvestors/assets tables are currently empty. You need to load data first.

Once you have data:

1. Navigate to: http://localhost:3003/superinvestors/920112
2. Refresh the page
3. Data should appear instantly from IndexedDB cache

## Checking Storage Status

### Browser Console
```javascript
// Check if storage is persistent
navigator.storage.persisted().then(console.log);

// Check storage usage
navigator.storage.estimate().then(console.log);
```

### DevTools → Application
- **IndexedDB:** Should show Zero database with tables
- **Local Storage:** Should show `zero_anon_user_id` key
- **Cookies:** Should show `jwt` cookie (if logged in)

## Expected Behavior After Fix

### ✅ First Load (Cold Start)
- Zero syncs data from PostgreSQL → Replica → IndexedDB
- Takes a few seconds depending on data size
- You see loading states

### ✅ Subsequent Refreshes (Warm Start)
- Data loads instantly from IndexedDB
- No loading states
- Background sync continues seamlessly
- No "Slow SQLite query" warnings

### ✅ Multiple Tabs
- All tabs share the same IndexedDB cache
- Changes in one tab appear in others instantly
- Real-time sync works across tabs

## Troubleshooting

### Still Seeing Slow Loads?

1. **Check browser mode:**
   ```
   ❌ Incognito/Private mode → IndexedDB is cleared on close
   ✅ Normal mode → IndexedDB persists
   ```

2. **Check browser extensions:**
   - Privacy extensions might block IndexedDB
   - Try disabling extensions temporarily

3. **Check replica file:**
   ```bash
   ls -lh .zero-data/hello_zero_replica.db
   ```
   Should show a file with size > 0

4. **Check Zero logs:**
   - Look for "Slow SQLite query" warnings
   - Should be gone with indexes

### Data Still Empty?

The superinvestors/assets tables need to be populated. Check if you have a data loading script or SQL dump to restore the data.

## Files Changed

- ✅ `.env` - Updated replica file path
- ✅ `src/schema.ts` - Removed cik_directory table
- ✅ `src/main.tsx` - Added stable userID and persistent storage
- ✅ `docker/migrations/08_add_performance_indexes.sql` - Added indexes
- ✅ `.gitignore` - Added .zero-data/

## Next Steps

1. **Test the fixes** using the steps above
2. **Load your data** into superinvestors/assets tables
3. **Monitor performance** - queries should be <10ms with indexes
4. **Enjoy instant refreshes!** 🚀
