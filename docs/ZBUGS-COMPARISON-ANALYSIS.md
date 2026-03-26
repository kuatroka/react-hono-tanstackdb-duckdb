# ZBugs vs Our Implementation - Comparison Analysis

## Executive Summary

After analyzing the [zbugs repository](https://github.com/rocicorp/mono/tree/main/apps/zbugs) from Rocicorp (creators of Zero sync), I found several key differences in how they handle Zero sync compared to our implementation. **Most importantly: they do NOT explicitly configure persistence or storageKey, yet they likely don't experience the same full data refresh issues we do.**

## Key Findings

### 1. **Persistence Configuration**

#### Our Implementation:
```typescript
// src/main.tsx
const storageKey = getStableStorageKey(); // "main"
<ZeroProvider {...{ userID, auth, server, schema, storageKey, getQueriesURL }}>
```

We explicitly:
- Set a stable `storageKey` parameter
- Request persistent storage via `navigator.storage.persist()`
- Store anonymous user IDs in localStorage

#### ZBugs Implementation:
```typescript
// src/zero-init.tsx
<ZeroProvider {...{
  schema,
  server: import.meta.env.VITE_PUBLIC_SERVER,
  userID: login.loginState?.decoded?.sub ?? 'anon',
  mutators: createMutators(login.loginState?.decoded),
  queries,
  logLevel: 'info',
  auth: login.loginState?.encoded,
  mutateURL: `${window.location.origin}/api/mutate`,
  getQueriesURL: `${window.location.origin}/api/get-queries`,
  context: login.loginState?.decoded,
}}>
```

They do NOT:
- Set a `storageKey` parameter (relies on Zero's default)
- Explicitly request persistent storage
- Have special handling for anonymous user IDs beyond 'anon'

**Insight**: Zero's default persistence behavior should work without explicit configuration. Our explicit configuration might be unnecessary or even counterproductive.

---

### 2. **Query Preloading Strategy**

#### Our Implementation:
```typescript
// No preloading strategy
// Queries are loaded on-demand when components mount
```

#### ZBugs Implementation:
```typescript
// src/zero-preload.ts
export function preload(z: ZeroBugs, projectName: string) {
  const q = z.query.issuePreloadV2({userID: z.userID, projectName});
  z.preload(q, CACHE_PRELOAD);
  z.preload(z.query.allUsers(), CACHE_PRELOAD);
  z.preload(z.query.allLabels(), CACHE_PRELOAD);
  z.preload(z.query.allProjects(), CACHE_PRELOAD);
}

// src/query-cache-policy.ts
export const CACHE_PRELOAD = {ttl: '10s'} as const;
```

They:
- Explicitly preload critical queries with `z.preload()`
- Use cache policies with TTL (time-to-live)
- Preload happens early in the app lifecycle

**Insight**: Preloading ensures critical data is in cache before components render, preventing "No data available" flashes.

---

### 3. **Query Cache Policies**

#### Our Implementation:
```typescript
// No explicit cache policies
// Queries use default Zero behavior
```

#### ZBugs Implementation:
```typescript
// src/query-cache-policy.ts
export const CACHE_NONE = {ttl: '10s'} as const;
export const CACHE_NAV = {ttl: '10s'} as const;
export const CACHE_PRELOAD = CACHE_NAV;

// Usage in components
const [issues] = useQuery(z.query.issueList(params), CACHE_NAV);
```

They:
- Define explicit cache policies with TTL
- Apply policies to queries based on usage patterns
- Use consistent TTL values across the app

**Insight**: Cache policies help Zero manage data freshness and prevent unnecessary refetches.

---

### 4. **Backend Architecture**

#### Our Implementation:
- **Framework**: Hono
- **Runtime**: Bun
- **Zero Endpoints**: `/api/zero/get-queries`

#### ZBugs Implementation:
- **Framework**: Fastify
- **Runtime**: Node.js
- **Zero Endpoints**: `/api/get-queries`, `/api/mutate`

```typescript
// server/index.ts
const queryRegistry = new QueryRegistry(queries);

fastify.post('/api/get-queries', async (request, reply) => {
  await withAuth(request, reply, async authData => {
    reply.send(
      await handleTransformRequest(
        (name: string, args: ReadonlyJSONValue | undefined) => {
          const query = queryRegistry.mustGet(name, authData);
          return query(args);
        },
        schema,
        request.body,
      ),
    );
  });
});
```

They:
- Use `QueryRegistry` to manage queries
- Pass auth context to queries
- Use `handleTransformRequest` from Zero server

**Insight**: The backend framework difference (Fastify vs Hono) shouldn't affect persistence, but the query handling approach might.

---

### 5. **Schema Definition**

#### Our Implementation:
```typescript
// src/schema.ts
export const schema = {
  version: 1,
  tables: {
    message: { ... },
    user: { ... },
    // ...
  }
};
```

#### ZBugs Implementation:
```typescript
// shared/schema.ts
import { createBuilder, createSchema, table, relationships } from '@rocicorp/zero';

const user = table('user')
  .columns({ ... })
  .primaryKey('id');

const issue = table('issue')
  .columns({ ... })
  .primaryKey('id');

// Define relationships
const userRelationships = relationships(user, ({many}) => ({
  createdIssues: many({ ... }),
}));

export const schema = createSchema({
  tables: { user, issue, ... },
  relationships: { user: userRelationships, ... },
});

export const builder = createBuilder(schema);
```

They:
- Use Zero's schema builder API
- Define relationships explicitly
- Use a builder pattern for queries

**Insight**: Using Zero's schema builder might provide better type safety and query optimization.

---

### 6. **User Authentication & Identity**

#### Our Implementation:
```typescript
// src/main.tsx
function getStableUserID(): string {
  const encodedJWT = Cookies.get("jwt");
  const decodedJWT = encodedJWT && decodeJwt(encodedJWT);

  if (decodedJWT?.sub) {
    return decodedJWT.sub as string;
  }

  // For anonymous users, use a stable ID from localStorage
  const ANON_USER_KEY = "zero_anon_user_id";
  let anonID = localStorage.getItem(ANON_USER_KEY);
  if (!anonID) {
    anonID = `anon_${crypto.randomUUID()}`;
    localStorage.setItem(ANON_USER_KEY, anonID);
  }
  return anonID;
}
```

#### ZBugs Implementation:
```typescript
// src/zero-init.tsx
userID: login.loginState?.decoded?.sub ?? 'anon'
```

They:
- Use a simple 'anon' string for all anonymous users
- Don't generate unique anonymous user IDs
- Rely on JWT for authenticated users

**Insight**: Using a single 'anon' userID for all anonymous users means they share the same cache. This is simpler and might be more efficient.

---

### 7. **Connection State Handling**

#### Our Implementation:
```typescript
// No explicit connection state handling
```

#### ZBugs Implementation:
```typescript
// src/root.tsx
const connectionState = useZeroConnectionState();

useEffect(() => {
  if (connectionState.name === 'needs-auth') {
    login.logout();
  }
}, [connectionState, login]);
```

They:
- Monitor connection state with `useZeroConnectionState()`
- Handle auth failures gracefully
- Provide user feedback on connection issues

**Insight**: Monitoring connection state helps detect and handle sync issues.

---

## Critical Question: Do They Experience Full Data Refresh?

Based on the code analysis, **zbugs likely does NOT experience full data refresh on every page reload** because:

1. **They rely on Zero's default persistence**: No explicit storageKey configuration suggests Zero's built-in IndexedDB persistence works correctly by default.

2. **They use preloading**: Critical queries are preloaded early, ensuring data is available from cache before components render.

3. **They use cache policies**: TTL-based cache policies prevent unnecessary refetches.

4. **Simpler user identity**: Using 'anon' for all anonymous users means shared cache, reducing complexity.

5. **No evidence of persistence issues**: No documentation or code comments about data refresh problems.

---

## Why We Might Be Experiencing Issues

### Hypothesis 1: Over-Configuration
Our explicit `storageKey` configuration might be interfering with Zero's default persistence behavior. Zero might be creating multiple IndexedDB databases or invalidating cache due to our custom configuration.

### Hypothesis 2: Missing Preloading
Without preloading, our queries might be fetching from the server on every page load instead of using cached data.

### Hypothesis 3: No Cache Policies
Without explicit cache policies, Zero might be treating every query as fresh, forcing server fetches.

### Hypothesis 4: Anonymous User ID Complexity
Generating unique anonymous user IDs might be causing cache fragmentation or invalidation.

### Hypothesis 5: Schema Version Mismatches
If our schema version changes frequently, Zero might be invalidating the cache on every reload.

---

## Recommendations

### 1. **Simplify Persistence Configuration** (High Priority)
Remove explicit storageKey configuration and rely on Zero's defaults:

```typescript
// src/main.tsx - REMOVE these:
// const storageKey = getStableStorageKey();
// requestPersistentStorage();

// Use simple userID:
const userID = encodedJWT ? decodeJwt(encodedJWT).sub : 'anon';

// ZeroProvider without storageKey:
<ZeroProvider {...{ userID, auth, server, schema, getQueriesURL }}>
```

### 2. **Implement Query Preloading** (High Priority)
Create a preload strategy for critical queries:

```typescript
// src/zero/preload.ts
export const CACHE_POLICY = {ttl: '10s'} as const;

export function preloadCriticalData(z: ReturnType<typeof useZero>) {
  z.preload(queries.listUsers(), CACHE_POLICY);
  z.preload(queries.listMediums(), CACHE_POLICY);
  z.preload(queries.superinvestorsList(), CACHE_POLICY);
  z.preload(queries.assetsList(), CACHE_POLICY);
}

// src/main.tsx
function AppContent() {
  const z = useZero<Schema>();

  useEffect(() => {
    preloadCriticalData(z);
  }, [z]);

  // ...
}
```

### 3. **Add Cache Policies to Queries** (Medium Priority)
Define and use cache policies:

```typescript
// src/zero/cache-policies.ts
export const CACHE_SHORT = {ttl: '10s'} as const;
export const CACHE_MEDIUM = {ttl: '1m'} as const;
export const CACHE_LONG = {ttl: '5m'} as const;

// Usage in components:
const [superinvestors] = useQuery(
  queries.superinvestorsList(),
  CACHE_MEDIUM
);
```

### 4. **Monitor Connection State** (Medium Priority)
Add connection state monitoring:

```typescript
// src/components/ConnectionMonitor.tsx
import { useZeroConnectionState } from '@rocicorp/zero/react';

export function ConnectionMonitor() {
  const connectionState = useZeroConnectionState();

  useEffect(() => {
    console.log('[Zero] Connection state:', connectionState);

    if (connectionState.name === 'needs-auth') {
      // Handle auth issues
    }
  }, [connectionState]);

  return null;
}
```

### 5. **Adopt Zero's Schema Builder** (Low Priority)
Consider migrating to Zero's schema builder API for better type safety and optimization:

```typescript
// src/schema.ts
import { createBuilder, createSchema, table } from '@rocicorp/zero';

const message = table('message')
  .columns({
    id: string(),
    body: string(),
    // ...
  })
  .primaryKey('id');

export const schema = createSchema({
  tables: { message, user, medium },
});

export const builder = createBuilder(schema);
```

---

## Testing Plan

### Phase 1: Simplify Configuration
1. Remove `storageKey` parameter
2. Remove `getStableStorageKey()` function
3. Remove `requestPersistentStorage()` call
4. Use simple 'anon' for anonymous users
5. Test page refresh behavior

### Phase 2: Add Preloading
1. Create preload function
2. Preload critical queries on app mount
3. Test page refresh behavior
4. Measure time to first render

### Phase 3: Add Cache Policies
1. Define cache policy constants
2. Apply policies to all queries
3. Test page refresh behavior
4. Monitor cache hit rates

### Phase 4: Monitor & Optimize
1. Add connection state monitoring
2. Add performance logging
3. Identify remaining issues
4. Optimize based on metrics

---

## Conclusion

The zbugs implementation suggests that **Zero's default persistence should work without explicit configuration**. Our issues likely stem from:

1. **Over-configuration**: Explicit storageKey might be interfering
2. **Missing preloading**: No preload strategy causes server fetches
3. **No cache policies**: Queries always fetch fresh data
4. **Complex anonymous identity**: Unique IDs cause cache fragmentation

**Recommended Next Steps**:
1. Start with Phase 1 (simplify configuration)
2. Test thoroughly after each phase
3. Monitor IndexedDB to verify single database
4. Measure page refresh performance

The goal is to achieve **instant page loads from cache** like zbugs does, with data appearing in < 100ms on refresh.

---

## Additional Resources

- [ZBugs Repository](https://github.com/rocicorp/mono/tree/main/apps/zbugs)
- [Zero Documentation](https://zero.rocicorp.dev/)
- [Zero React Hooks](https://zero.rocicorp.dev/docs/react)
- [Zero Server API](https://zero.rocicorp.dev/docs/server)

---

**Status**: Analysis complete. Ready to implement recommendations.
