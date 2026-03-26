# Zero Synced Queries API Documentation Update

**Date:** 2025-11-22
**Reference:** https://zero.rocicorp.dev/docs/synced-queries

## Summary

Updated all Zero-sync documentation to reflect the new **Synced Queries API** pattern instead of the deprecated direct ZQL query pattern.

## What Changed

### Documentation Files Updated

1. **`openspec/AGENTS.md`** - Critical architecture patterns section
2. **`docs/ZERO-SYNC-PATTERNS.md`** - Quick reference guide
3. **`docs/CURRENT-STATE.md`** - Current implementation documentation

### Key Changes

#### Old Pattern (Deprecated)
```typescript
// ❌ Direct ZQL queries (deprecated)
const z = useZero<Schema>();
const [entities] = useQuery(
  z.query.entities
    .where('name', 'ILIKE', `%${search}%`)
    .limit(10)
);
```

**Problems with old pattern:**
- No server-side permission enforcement
- No parameter validation
- Can't control query implementation from server
- Security risk: clients can query any data

#### New Pattern (Current)
```typescript
// ✅ Synced queries (current best practice)

// Step 1: Define in src/zero/queries.ts
import { escapeLike, syncedQuery } from "@rocicorp/zero";
import { z } from "zod";
import { builder } from "../schema";

export const queries = {
  searchEntities: syncedQuery(
    "entities.search",
    z.tuple([z.string(), z.number().int().min(0).max(50)]),
    (rawSearch, limit) => {
      const search = rawSearch.trim();
      if (!search) {
        return builder.entities.limit(0);
      }
      return builder.entities
        .where('name', 'ILIKE', `%${escapeLike(search)}%`)
        .limit(limit);
    }
  ),
} as const;

// Step 2: Use in components
import { useQuery } from '@rocicorp/zero/react';
import { queries } from '../zero/queries';

const [entities] = useQuery(queries.searchEntities(search, 10));
```

**Benefits of new pattern:**
- ✅ Server controls query implementation (security & permissions)
- ✅ Parameter validation with Zod schemas
- ✅ Data synced to local IndexedDB automatically
- ✅ Queries execute instantly against local cache
- ✅ Zero handles server sync in background
- ✅ No network latency for cached data
- ✅ Reactive updates when data changes

## Current Implementation Status

### ✅ Already Implemented

The codebase already has the new pattern implemented:

1. **`src/zero/queries.ts`** - Defines all synced queries
2. **`api/routes/zero/get-queries.ts`** - Server endpoint for query resolution
3. Most components already use synced queries from `queries` object

### ⚠️ Still Using Old Pattern

Some files still use direct ZQL queries and need migration:

1. **`src/components/CikSearch.tsx`** - Uses `z.query.searches` directly
2. **`src/pages/EntitiesList.tsx`** - Uses `zero.query.entities` directly
3. **`src/pages/EntityDetail.tsx`** - Uses `zero.query.entities` directly
4. **`src/App.tsx`** - Uses `z.query.user` and `z.query.medium` directly
5. **`src/main.tsx`** - Uses `z.query.*` directly

## Server Implementation

The server endpoint is already properly implemented:

```typescript
// api/routes/zero/get-queries.ts
import { Hono } from "hono";
import { withValidation } from "@rocicorp/zero";
import { handleGetQueriesRequest } from "@rocicorp/zero/server";
import { queries } from "../../../src/zero/queries";
import { schema } from "../../../src/schema";

const validatedQueries = new Map(
  Object.values(queries).map((query) => [query.queryName, withValidation(query)])
);

const zeroRoutes = new Hono();

zeroRoutes.post("/get-queries", async (c) => {
  const response = await handleGetQueriesRequest(
    (name, args) => {
      const query = validatedQueries.get(name);
      if (!query) {
        throw new Error(`Query not found: ${name}`);
      }
      return { query: query(undefined, ...args) };
    },
    schema,
    c.req.raw
  );
  return c.json(response);
});

export default zeroRoutes;
```

## Documentation Updates Made

### openspec/AGENTS.md

- Updated "Zero-Sync Architecture Patterns (CRITICAL)" section
- Added comprehensive examples of synced query definition and usage
- Added new "❌ WRONG: Direct ZQL Queries (Deprecated)" section
- Updated all code examples to show synced queries pattern
- Updated "Common Mistakes to Avoid" section
- Updated "Synced Query Patterns" section with proper examples
- Updated "Decision Tree" to reference synced queries

### docs/ZERO-SYNC-PATTERNS.md

- Updated core principle to mention Synced Queries API
- Added reference link to official documentation
- Restructured to show 3-step process: Define → Implement → Use
- Updated all code examples to use synced queries
- Added new "❌ Direct ZQL Queries (Deprecated)" section
- Updated decision tree
- Updated "Common Mistakes We Made" section
- Added reference link at the end

### docs/CURRENT-STATE.md

- Updated search implementation examples
- Updated preloading examples
- Added benefits of synced queries approach

## Next Steps (Optional)

To complete the migration to synced queries:

1. **Migrate remaining components** to use synced queries:
   - Add missing queries to `src/zero/queries.ts`
   - Update components to import and use `queries` object
   - Remove direct `z.query.*` or `zero.query.*` usage

2. **Add linting rule** (optional) to prevent direct ZQL usage:
   - Create ESLint rule to flag `z.query.*` or `zero.query.*` patterns
   - Enforce synced queries pattern across codebase

3. **Disable legacy queries** (optional):
   - Set `enableLegacyQueries: false` in Zero schema
   - Force all queries to go through synced queries API

## References

- **Official Documentation:** https://zero.rocicorp.dev/docs/synced-queries
- **Implementation:** `src/zero/queries.ts`
- **Server Endpoint:** `api/routes/zero/get-queries.ts`
- **Architecture Guide:** `openspec/AGENTS.md` (lines 404-730)
- **Quick Reference:** `docs/ZERO-SYNC-PATTERNS.md`
