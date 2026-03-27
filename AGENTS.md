## Tech Stack and javascript runtime
- Use bun for package manager and js runtime. Never use node.js - https://bun.com/llms-rules.txt
- bun - https://bun.sh/llms.txt

## Drizzle ORM for schema management and migrations
- Drizzle llm docs - https://orm.drizzle.team/llms.txt
- Drizzle llm docs Full - https://orm.drizzle.team/llms-full.txt

## The project

It's a web app with **DuckDB** as main analytics DB work with **TanStack DB** on the frontend to make the UI interactions as immediate as possible. Performance is the number one priority.



## Analytics and main DB is Duckdb
1. Duckdb docs - https://duckdb.org/llms.txt
2. Main data is stored in the **duckdb** DB in a local under variable **DUCKDB_PATH** in .env
3. Transaction and Master data in **parquet** files in the directory **APP_DATA_PATH** in .env
4. **TanStack DB** for a reactive, client-first store for API data with collections, live queries and optimistic mutations that keep UI reactive. It's used in conjuntion with Dexie.js and IndexedDB

This project uses **drizzle-orm** for schema generation only for the **Postgres**.

## JS runtime and package management
- **bun**
- bun docs - https://bun.sh/llms.txt
- bun docs full - https://bun.sh/llms-full.txt

## Backend Server - **hono** 

### Key Commands
```bash

bun run dev:db-up             # to start the dev Postgres container
bun run dev:db-down           # to stop the dev Postgres container
bun run dev:clean             # to delete data volumes Posgtres (use after stopping db)
bun run db:generate           # Generate Drizzle migration only
bun run db:migrate            # Apply migrations to database only
bun run dev                   # launches the web app

```
