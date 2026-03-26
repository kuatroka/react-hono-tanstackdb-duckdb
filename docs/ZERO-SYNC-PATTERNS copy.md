# Zero-Sync Data Access Patterns

**Quick Reference Guide for Developers**

## 🎯 Core Principle

**This is a local-first application using Zero-sync.**

All database queries MUST use Zero's **Synced Queries API**, NOT custom REST API endpoints or direct ZQL queries.

**📚 Reference:** https://zero.rocicorp.dev/docs/synced-queries

---

## ✅ CORRECT Patterns

### Step 1: Define Synced Queries

Create queries in `src/zero/queries.ts`:

```typescript
import { escapeLike, syncedQuery } from "@rocicorp/zero";
import { z } from "zod";
import { builder } from "../schema";

export const queries = {
  // Simple query - list all entities
  listEntities: syncedQuery(
    "entities.list",
    z.tuple([]),
    () => builder.entities.orderBy('name', 'asc')
  ),

  // Filtered query - by category
  entitiesByCategory: syncedQuery(
    "entities.byCategory",
    z.tuple([z.enum(["investor", "asset"])]),
    (category) => builder.entities.where('category', '=', category)
  ),

  // Sorted and limited
  recentEntities: syncedQuery(
    "entities.recent",
    z.tuple([z.number().int().positive().max(500)]),
    (limit) => builder.entities.orderBy('created_at', 'desc').limit(limit)
  ),
} as const;
```

### Step 2: Use in Components

```typescript
import { useQuery } from "@rocicorp/zero/react";
import { queries } from "../zero/queries";

function MyComponent() {
  // Simple query
  const [entities] = useQuery(queries.listEntities());

  // Filtered query
  const [investors] = useQuery(queries.entitiesByCategory('investor'));

  // Sorted and limited
  const [recent] = useQuery(queries.recentEntities(50));
}
```

### Search Functionality

**Define the query:**
```typescript
// In src/zero/queries.ts
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
```

**Use in component:**
```typescript
import { useQuery } from "@rocicorp/zero/react";
import { queries } from "../zero/queries";

function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results] = useQuery(queries.searchEntities(query, 5));

  return (
    <>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {results.map(r => <div key={r.id}>{r.name}</div>)}
    </>
  );
}
```

### Preloading for Instant Queries
```typescript
// In main.tsx or app initialization
import { getZero } from './zero-client';
import { queries } from './zero/queries';

function App() {
  const z = getZero();

  useEffect(() => {
    // Preload 500 most recent entities
    z.preload(queries.recentEntities(500));
  }, []);

  return <Router />;
}
```

### Multiple Conditions

**Define the query:**
```typescript
// In src/zero/queries.ts
highValueInvestors: syncedQuery(
  "entities.highValueInvestors",
  z.tuple([z.number().int()]),
  (minValue) =>
    builder.entities
      .where('category', '=', 'investor')
      .where('value', '>', minValue)
      .orderBy('value', 'desc')
);
```

### Relationships

**Define the query:**
```typescript
// In src/zero/queries.ts
messagesWithPartners: syncedQuery(
  "messages.withPartners",
  z.tuple([]),
  () =>
    builder.messages
      .related('sender')
      .where('sender.isPartner', '=', true)
),
```

**Use in component:**
```typescript
const [messages] = useQuery(queries.messagesWithPartners());
```

---

## ❌ WRONG Patterns (DO NOT USE)

### ❌ Direct ZQL Queries (Deprecated)
```typescript
// ❌ WRONG - Direct ZQL query (deprecated)
const z = useZero<Schema>();
const [entities] = useQuery(
  z.query.entities.where('name', 'ILIKE', `%${search}%`)
);
```

**Why wrong:**
- No server-side permission enforcement
- No parameter validation
- Can't control query implementation from server
- Deprecated in favor of synced queries
- Security risk: clients can query any data

**✅ Solution:** Define a synced query in `src/zero/queries.ts`

### ❌ Custom Search API Endpoint
```typescript
// ❌ WRONG - Don't create this
app.get("/api/search", async (c) => {
  const query = c.req.query("q");
  const results = await db.query(
    "SELECT * FROM entities WHERE name ILIKE $1",
    [`%${query}%`]
  );
  return c.json(results);
});

// ❌ WRONG - Don't fetch like this
const results = await fetch(`/api/search?q=${query}`)
  .then(r => r.json());
```

**Why wrong:**
- Bypasses Zero-sync
- Network round-trip every time
- No local caching
- No reactive updates
- Defeats local-first architecture

### ❌ Custom Data Query Endpoints
```typescript
// ❌ WRONG - Don't create these
app.get("/api/entities", async (c) => { /* ... */ });
app.get("/api/investors", async (c) => { /* ... */ });
app.get("/api/assets/:id", async (c) => { /* ... */ });
```

**Use Zero queries instead!**

### ❌ PostgreSQL Full-Text Search Extensions
```sql
-- ❌ WRONG - Zero doesn't use these
CREATE EXTENSION pg_trgm;
CREATE INDEX idx_entities_search_trgm
  ON entities USING GIN (name gin_trgm_ops);
```

**Use simple B-tree indexes instead:**
```sql
-- ✅ CORRECT
CREATE INDEX idx_entities_name ON entities(name);
CREATE INDEX idx_entities_category ON entities(category);
```

---

## ✅ When to Use Hono API Endpoints

Use Hono API endpoints ONLY for these cases:

### 1. Authentication/Authorization
```typescript
// ✅ CORRECT - Auth is server-side
app.post("/api/auth/login", async (c) => {
  const { email, password } = await c.req.json();
  const user = await verifyCredentials(email, password);
  const token = await generateJWT(user);
  return c.json({ token });
});
```

### 2. External Integrations
```typescript
// ✅ CORRECT - Third-party webhooks
app.post("/api/stripe/webhook", async (c) => {
  const signature = c.req.header("stripe-signature");
  await handleStripeWebhook(c.req, signature);
  return c.json({ received: true });
});
```

### 3. File Uploads/Downloads
```typescript
// ✅ CORRECT - Binary data
app.post("/api/upload", async (c) => {
  const formData = await c.req.formData();
  const file = formData.get("file");
  const url = await uploadToS3(file);
  return c.json({ url });
});
```

### 4. Heavy Server-Side Computations
```typescript
// ✅ CORRECT - CPU-intensive processing
app.post("/api/reports/generate", async (c) => {
  const { startDate, endDate } = await c.req.json();
  const pdf = await generateLargeReport(startDate, endDate);
  return c.body(pdf, 200, {
    'Content-Type': 'application/pdf'
  });
});
```

---

## 🤔 Decision Tree

```
Need to implement a feature?
│
├─ Is it reading/querying database data?
│  └─ ✅ Define synced query in src/zero/queries.ts
│
├─ Is it search/filter/sort?
│  └─ ✅ Define synced query with ILIKE
│
├─ Is it authentication/authorization?
│  └─ ✅ Use Hono API endpoint
│
├─ Is it calling external service?
│  └─ ✅ Use Hono API endpoint
│
├─ Is it file upload/download?
│  └─ ✅ Use Hono API endpoint
│
└─ Is it heavy server computation?
   └─ ✅ Use Hono API endpoint
```

---

## 📚 Zero Query API Reference

### Filtering
```typescript
.where('column', '=', value)       // Exact match
.where('column', '>', value)       // Greater than
.where('column', '<', value)       // Less than
.where('column', 'ILIKE', pattern) // Case-insensitive LIKE
```

### Sorting
```typescript
.orderBy('column', 'asc')   // Ascending
.orderBy('column', 'desc')  // Descending
```

### Limiting
```typescript
.limit(10)           // First 10 rows
.offset(20)          // Skip first 20 rows
.limit(10).offset(20) // Pagination
```

### Relationships
```typescript
.related('relationName')                    // Include related data
.where('relationName.column', '=', value)   // Filter by related data
```

### Preloading
```typescript
z.preload(query)  // Cache query results for instant access
```

---

## 🎓 Why Zero-Sync?

**Benefits of using Zero queries:**

1. **Instant queries** - Data cached in IndexedDB, no network latency
2. **Reactive updates** - UI updates automatically when data changes
3. **Offline support** - Queries work without network connection
4. **Multi-tab sync** - Changes sync across browser tabs instantly
5. **Optimistic updates** - UI updates immediately, syncs in background
6. **Automatic caching** - Zero manages cache invalidation
7. **Type safety** - Full TypeScript support with schema

**What you lose with custom REST APIs:**
- ❌ Network latency on every request
- ❌ No offline support
- ❌ No reactive updates
- ❌ Manual cache management
- ❌ No multi-tab sync
- ❌ Pessimistic updates (wait for server)

---

## 📖 Reference Implementation

**See these files for correct patterns:**

- `src/components/GlobalSearch.tsx` - Zero-based search
- `src/pages/EntitiesList.tsx` - Filtering and pagination
- `src/pages/EntityDetail.tsx` - Single entity query
- `src/main.tsx` - Preloading setup
- `src/schema.ts` - Schema definition

---

## 🚨 Common Mistakes We Made

### Mistake 1: Used direct ZQL queries
**Problem:** No server-side permission enforcement, security risk
**Solution:** Migrated to synced queries defined in `src/zero/queries.ts`

### Mistake 2: Created /api/search endpoint
**Problem:** Bypassed Zero-sync for search
**Solution:** Removed endpoint, defined synced query with ILIKE

### Mistake 3: Added PostgreSQL full-text search
**Problem:** Zero doesn't use pg_trgm or GIN indexes
**Solution:** Removed extensions, used simple B-tree indexes

### Mistake 4: Used TanStack Query for data fetching
**Problem:** Unnecessary dependency, Zero has built-in reactivity
**Solution:** Removed TanStack Query, used Zero's useQuery with synced queries

---

## 💡 Key Takeaway

**If it's in the database and needs to sync, use synced queries.**

**If it's auth, external, files, or heavy compute, use Hono API.**

**📚 Reference:** https://zero.rocicorp.dev/docs/synced-queries

That's it!

---

For more details, see:
- `openspec/project.md` - Project conventions
- `openspec/AGENTS.md` - AI agent instructions
- [Zero Documentation](https://zerosync.dev)
