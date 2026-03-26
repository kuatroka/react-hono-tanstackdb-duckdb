# Zero Hono React Counter uPlot

A real-time analytics application demonstrating **Zero-sync** (Rocicorp's sync framework) with React, Bun, Hono, and PostgreSQL.

## Features

- **🔍 Global Search:** Instant client-side search across 1000 investors and assets using Zero-sync
- **📊 Counter & Charts:** Interactive counter with 10 different uPlot chart visualizations
- **⚡ Real-time Sync:** Zero-sync keeps data synchronized across multiple browser tabs
- **🎯 Modern Stack:** React 19 + Bun + Hono + PostgreSQL + React Router

## Hidden Routes

The following routes are available but not linked in the navigation:

- **`/counter`** - Interactive counter with 10 different uPlot chart visualizations
- **`/messages`** - Messages demo page with real-time sync features

**📖 Documentation:**
- [CURRENT-STATE.md](./CURRENT-STATE.md) - Architecture and implementation history
- [ZERO-SYNC-PATTERNS.md](./ZERO-SYNC-PATTERNS.md) - **Zero-sync data access patterns (MUST READ)**

## Tech Stack

This project uses **Bun** as both the JavaScript runtime and package manager, providing significantly better performance than Node.js. Bun is used to run the Hono API server and manage all dependencies.

## Option 1: Run this repo

First, install dependencies:

```sh
bun install
```

Next, start the PostgreSQL database:

```sh
bun run dev:db-up
```

**In a second terminal**, start all application services (API + UI + Zero Cache):

```sh
bun run dev
```

This will start the Hono API server (Bun), Vite dev server (React UI), and Zero cache server concurrently with color-coded output.

## Option 2: Install Zero in your own project

This guide explains how to set up Zero in your React application, using this
repository as a reference implementation.

### Prerequisites

**1. PostgreSQL database with Write-Ahead Logging (WAL) enabled**

See [Connecting to Postgres](https://zero.rocicorp.dev/docs/connecting-to-postgres)

**2. Environment Variables**

Set the following environment variables. `ZSTART_UPSTREAM_DB` is the URL to your Postgres
database.

```ini
# Your application's data
ZERO_UPSTREAM_DB="postgresql://user:password@127.0.0.1/postgres"

# Secret to decode auth token.
ZERO_AUTH_SECRET="secretkey"

# Place to store sqlite replica file.
ZERO_REPLICA_FILE="/tmp/zstart_replica.db"

# Where UI will connect to zero-cache.
VITE_PUBLIC_SERVER=http://localhost:4848
```

### Setup

1. **Install Zero**

```bash
bun add @rocicorp/zero
```

2. **Create Schema** Define your database schema using Zero's schema builder.
   See [schema.ts](src/schema.ts) for example:

```typescript
import { createSchema, table, string } from "@rocicorp/zero";

const user = table("user")
  .columns({
    id: string(),
    name: string(),
  })
  .primaryKey("id");

export const schema = createSchema({
  tables: [user],
});

export type Schema = typeof schema;
```

3. **Initialize Zero Client-Side** Set up the Zero provider in your app entry
   point. See [main.tsx](src/main.tsx):

```tsx
import { Zero } from "@rocicorp/zero";
import { ZeroProvider } from "@rocicorp/zero/react";
import { schema } from "./schema";

// In a real app, you might initialize this inside of useMemo
// and use a real auth token
const z = new Zero({
  userID: "your-user-id",
  auth: "your-auth-token",
  server: import.meta.env.VITE_PUBLIC_SERVER,
  schema,
});

createRoot(document.getElementById("root")!).render(
  <ZeroProvider zero={z}>
    <App />
  </ZeroProvider>
);
```

4. **Using Zero in Components** Example usage in React components. See
   [App.tsx](src/App.tsx):

```typescript
import { useQuery, useZero } from "@rocicorp/zero/react";
import { Schema } from "./schema";

// You may want to put this in its own file
const useZ = useZero<Schema>;

export function UsersPage() {
  const z = useZ();
  const users = useQuery(z.query.user);

  if (!users) {
    return null;
  }

  // Use the data...
  return (
    <div>
      {users.map((user) => (
        <div key={user.id}>{user.name}</div>
      ))}
    </div>
  );
}
```

For more examples of queries, mutations, and relationships, explore the
[App.tsx](src/App.tsx) file in this repository.

### Optional: Authentication

This example includes JWT-based authentication. See [api/index.ts](api/index.ts)
for an example implementation using Hono.

## Development

This project uses `concurrently` to run multiple development servers simultaneously, reducing the number of terminal windows you need to manage.

### Recommended Workflow (Two Terminals)

**Terminal 1: Start the PostgreSQL database**

```bash
bun run dev:db-up
```

**Terminal 2: Start all application services (API + UI + Zero Cache)**

```bash
bun run dev
```

This single command runs three services concurrently with color-coded output:
- **API Server** (cyan) - Hono API on Bun runtime at `http://localhost:4001`
- **UI Server** (magenta) - Vite dev server for React at `http://localhost:3001`
- **Zero Cache** (yellow) - Zero sync cache server at `http://localhost:4848`

### Local Dev Ports

- `3001` for Vite UI
- `4001` for API server
- `4848` for Zero cache
- `4849` for Zero change-streamer

### Verified Local Runtime Contract

The current working local setup uses:

- **UI:** `http://localhost:3001`
- **API:** `http://localhost:4001`
- **Zero Cache:** `http://localhost:4848`
- **Zero query endpoint (browser-facing):** `http://localhost:4001/api/zero/get-queries`
- **Zero query endpoint (server-facing):** `ZERO_QUERY_URL="http://localhost:4001/api/zero/get-queries"`

Important: in Zero 1.x the browser-facing query URL must exactly match the API URL that Zero Cache is allowed to call. In this repo that is `http://localhost:4001/api/zero/get-queries` for both `VITE_ZERO_GET_QUERIES_URL` and `ZERO_QUERY_URL`.

### Alternative: Individual Commands (For Debugging)

If you need to run services separately for debugging purposes:

```bash
# Terminal 1: Database
bun run dev:db-up

# Terminal 2: API Server
bun run dev:api

# Terminal 3: UI Server
bun run dev:ui

# Terminal 4: Zero Cache
bun run dev:zero-cache
```

### Experimental: One Terminal

If your database can run in the background, you can start everything with:

```bash
bun run dev:all
```

This starts the database, waits 3 seconds for it to initialize, then starts all application services.

### Stopping Services

- Press `Ctrl+C` in the terminal running `bun run dev` to stop all application services
- Press `Ctrl+C` in the database terminal, or run `bun run dev:db-down` to stop the database

### Cleaning Up

To remove all database volumes and Zero replica files:

```bash
bun run dev:clean
```

To reset only local Zero replica/runtime state:

```bash
bun run zero:reset
```

### Which command do I run?

- **Normal local development:** `bun run dev`
  - This is the default command.
  - It starts API, UI, and Zero together.
  - Zero preflight already runs automatically inside `dev:zero-cache`.
- **Test the Zero preflight guard itself:** `bun run test:zero-preflight`
  - Use this when editing `scripts/zero-preflight.mjs` or related Zero startup logic.
  - This does not start the app.
- **Zero is acting strange locally:** `bun run zero:reset`
  - This clears the local Zero replica and fingerprint state.
  - Then restart with `bun run dev`.

### Zero Runtime Safety

This repo now runs a Zero preflight before `dev:zero-cache` starts.

It fingerprints the local Zero runtime using:
- `@rocicorp/zero` version
- `@rocicorp/zero-sqlite3` version
- active Node version
- platform/arch

If that fingerprint changes, the preflight automatically wipes the local SQLite replica at `ZERO_REPLICA_FILE` before Zero starts. This prevents stale local replicas from being reused across Zero upgrades, native module changes, or Node runtime drift.

Important:
- Wiping the local Zero replica is safe in development.
- The preflight does **not** wipe Postgres data.
- Zero should run on a supported Node version. For this repo, prefer Node 24.x.
- If you intentionally want a fresh local Zero state, run `bun run zero:reset`.

### Troubleshooting

**Port Conflicts:**

If you get "address already in use" errors for ports 4849 or 4848, kill the stuck processes:

```bash
# Kill processes using Zero Cache ports
lsof -ti:4849 | xargs kill -9
```

**Check what's running on ports:**
```bash
lsof -i :4849
```

## Database Migrations

This project uses [Drizzle ORM](https://orm.drizzle.team/) for schema management.

**1. Modify Schema**
Edit `src/db/schema.ts` (Drizzle) and `src/schema.ts` (Zero client schema) to add/change tables or columns.

**2. Generate Migration**
Create SQL migration files from your schema changes:
```bash
bun run db:generate
```

**3. Apply Migration (Zero-downtime)**
Apply changes to the running PostgreSQL database:
```bash
bun run db:migrate
```

This uses `ALTER TABLE` statements that are safe to run while the app, Zero cache, and UI are online. Existing data is preserved.

**4. Refresh Zero cache schema (recommended)**
When you add new tables/columns that Zero should sync:
- If running `bun run dev` (concurrently), stop and restart it, or
- If running `bun run dev:zero-cache` separately, restart just the Zero cache process.

On restart, Zero introspects the updated PostgreSQL schema and begins syncing the new tables/columns you defined in `src/schema.ts`.

## Performance Benchmarking

This project uses Bun as the runtime for the Hono API server, which provides significant performance improvements over Node.js.

### Running Benchmarks

To benchmark the API server performance, use `autocannon`:

**1. Start the API server:**

```bash
bun run dev:api
```

**2. In a separate terminal, run the benchmark:**

```bash
bunx autocannon -c 100 -d 30 http://localhost:4001/api/counter
```

This command runs a 30-second load test with 100 concurrent connections.

### Interpreting Results

Look for these key metrics in the output:

- **Requests/sec**:
  - ✅ **20,000+ req/sec** - Excellent (Bun is working great)
  - ⚠️ **< 10,000 req/sec** - May indicate performance issues

- **Latency avg**:
  - ✅ **< 10ms** - Great performance
  - ⚠️ **> 50ms** - May need optimization

- **Latency p99**:
  - ✅ **< 50ms** - Consistent performance
  - ⚠️ **> 200ms** - High tail latency, investigate bottlenecks

If your results meet the "Excellent" criteria, your Bun + Hono setup is performing optimally!

## Container Runtime

This project automatically detects and uses either **Podman** or **Docker** for running the PostgreSQL database. The detection verifies that the runtime is not only installed but also **functional** before selecting it.

### Prerequisites

You must have either Podman or Docker installed and running:

- **Podman** (recommended): [Install Podman](https://podman.io/getting-started/installation)
  - On macOS: After installation, run `podman machine init` and `podman machine start`
- **Docker**: [Install Docker](https://docs.docker.com/get-docker/)
  - Ensure Docker Desktop is running before starting the database

The database scripts (`bun run dev:db-up`, `bun run dev:db-down`, `bun run dev:clean`) will automatically detect which runtime is available and use it.

### Detection Priority

1. **Podman** - Checked first (verifies `podman info` succeeds)
2. **Docker** - Used if Podman is not functional (verifies `docker info` succeeds)
3. **Error** - If neither is functional, you'll see a clear error message with setup instructions

### Docker Compose Compatibility

If using Docker, ensure you have Docker Compose installed:
- Docker Desktop includes Compose by default
- For standalone Docker Engine, install the Compose plugin: [Install Docker Compose](https://docs.docker.com/compose/install/)

## Troubleshooting

### Container Runtime Not Found or Not Functional

If you see an error like "Neither podman nor docker is installed or functional":

1. **Install** either Podman or Docker (see Container Runtime section above)
2. **Start the runtime**:
   - Podman (macOS): `podman machine start`
   - Docker: Launch Docker Desktop
3. **Verify** the runtime is working:
   - Podman: `podman info`
   - Docker: `docker info`

### Zero SQLite3 Native Module Issues

If you encounter errors related to the `@rocicorp/zero-sqlite3` native module (such as module loading errors or crashes), you may need to rebuild it from source for your specific platform:

```bash
npm rebuild @rocicorp/zero-sqlite3
```

This is particularly important when:
- Switching between different operating systems or architectures
- Upgrading Bun versions
- After cloning the repository on a new machine
- Experiencing crashes or "module not found" errors related to SQLite
