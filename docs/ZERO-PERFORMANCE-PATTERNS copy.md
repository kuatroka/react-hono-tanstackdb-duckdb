# Zero Performance Patterns

Performance optimizations based on analysis of [ztunes](https://github.com/rocicorp/ztunes) (88k artists, 200k albums) and Zero documentation.

## Key Principles

### 1. TTL Strategy (5 minutes)

All queries use a **5-minute TTL** instead of short TTLs like 10s. This allows:
- Instant re-navigation when returning to a page within 5 minutes
- Automatic real-time updates while cached
- Reduced server load

```typescript
// ✅ Good - allows instant re-navigation
useQuery(queries.assetsPage(limit, 0), { ttl: '5m' });

// ❌ Avoid - forces server round-trip too often
useQuery(queries.assetsPage(limit, 0), { ttl: '10s' });
```

### 2. Preload Strategy

Preload data at app startup for **instant local search** and **instant browsing**:

```typescript
export function preload(z: Zero<Schema>, { limit = 200 } = {}) {
  const TTL = "5m";

  // Browsing data (windowed pagination)
  z.preload(queries.assetsPage(limit, 0), { ttl: TTL });
  z.preload(queries.superinvestorsPage(limit, 0), { ttl: TTL });

  // Search index for instant local search (1000 rows per category)
  z.preload(queries.searchesByCategory("assets", "", 1000), { ttl: TTL });
  z.preload(queries.searchesByCategory("superinvestors", "", 1000), { ttl: TTL });

  // Global search index
  z.preload(queries.searchesByName("", 100), { ttl: TTL });
}
```

**Why preload the search index?**
When users search, results come from preloaded local data instantly. Server results arrive async but don't "jostle" the UI because both local and server results are sorted alphabetically (local results are a valid prefix of full results).

### 3. Windowed Pagination

Don't sync the entire table—use **windowed pagination** with a moving window.

Zero only syncs up to the `limit` you pass into a query. To support deep
pagination (thousands of rows) without loading everything at once, grow the
window as the user pages:

```typescript
const tablePageSize = 10;
const DEFAULT_WINDOW_LIMIT = 1000;      // Fast initial load
const MAX_WINDOW_LIMIT = 50000;         // Hard cap for synced rows
const MARGIN_PAGES = 5;                 // Preload a few pages ahead

const [windowLimit, setWindowLimit] = useState(() => {
  const required = currentPage * tablePageSize;
  const base = Math.max(DEFAULT_WINDOW_LIMIT, required + tablePageSize * MARGIN_PAGES);
  return Math.min(base, MAX_WINDOW_LIMIT);
});

// Query only the current window from Zero
const [assetsPageRows] = useQuery(
  queries.assetsPage(windowLimit, 0),
  { ttl: "5m", enabled: !trimmedSearch }
);

// When the user pages forward, expand the window if needed
useEffect(() => {
  if (trimmedSearch) return; // search mode ignores windowLimit
  const required = currentPage * tablePageSize;
  if (required > windowLimit) {
    setWindowLimit(prev => {
      const base = Math.max(prev, required + tablePageSize * MARGIN_PAGES);
      return Math.min(base, MAX_WINDOW_LIMIT);
    });
  }
}, [currentPage, windowLimit, trimmedSearch]);
```

This pattern (inspired by ztunes) gives you:

- **Fast cold start**: only ~1k rows synced initially
- **Smooth browsing**: as users page deeper, Zero syncs more rows on demand
- **Hard upper bound**: `MAX_WINDOW_LIMIT` protects memory and keeps sync work bounded

### 4. Jostle-Free Search UX

From ztunes: *"We want to provide instant results over local data, but we don't want to 'jostle' (reorder) those results when server results come in."*

**Solution:** Sort all query results consistently (alphabetically by name). This ensures:
- Local results are always a valid prefix of server results
- New results appear below existing results, not reordering them

### 5. Search Performance Note

Zero currently lacks first-class text indexing. Searches can be O(n) when:
- There are fewer matching records than the `limit`
- Sort order doesn't match an index

For ~32k assets and ~15k superinvestors, this is acceptable. For larger datasets, consider server-side search or wait for Zero's upcoming text indexing feature.

## Architecture Summary

```
┌────────────────────────────────────────────────────────────┐
│                      App Startup                            │
├────────────────────────────────────────────────────────────┤
│  preload() runs automatically:                              │
│  • 200 assets/superinvestors (browsing window)             │
│  • 1000 search index rows per category                     │
│  • Global search index (100 rows)                          │
│  • Reference data (users, mediums)                         │
└────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│                     User Interaction                        │
├────────────────────────────────────────────────────────────┤
│  Browsing:                                                  │
│  • Data from preloaded window → instant                    │
│  • Beyond window → loads from server (background)          │
│                                                            │
│  Search:                                                   │
│  • Local results from preloaded index → instant            │
│  • Server results arrive async → append below              │
│                                                            │
│  Navigation:                                               │
│  • Return within 5m → instant (TTL cached)                 │
│  • Return after 5m → re-fetch (still reactive)             │
└────────────────────────────────────────────────────────────┘
```

## Files Modified

| File | Change |
|------|--------|
| `src/zero-preload.ts` | Preload search indexes + increase TTL to 5m |
| `src/pages/AssetsTable.tsx` | Increase TTL to 5m |
| `src/pages/SuperinvestorsTable.tsx` | Increase TTL to 5m |
| `src/components/CikSearch.tsx` | Increase TTL to 5m |

## References

- [ztunes README](https://github.com/rocicorp/ztunes) - Best practices for large datasets
- [Zero Reading Data](https://zero.rocicorp.dev/docs/reading-data) - TTLs, preloading, consistency
- [Zero Synced Queries](https://zero.rocicorp.dev/docs/synced-queries) - Query patterns
