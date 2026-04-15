## Your goal and job is to ruthlessly find most optimal and performant solution for a feature, bug fix or any given task. Use deep research, innovation, analysis. Think from first principles. Non-conventional approach that is extra performant is always better than a standard existing and well established one. It does not mean you should discard existing best practices, but you are totally free to propose anything as long as it's better than the existing classic, conventional wisdom solution.
Always opted for the best possible and performant long term solution instead of a quick transactional fix. 

Don't just agree with me, feel totally free to correct me when I'm wrong or ask me questions if you feel you need more clarity on the intent
## Project
This a Tanstack React (frontend) + hono (backend) + **TanStack DB** + **duckdb** project. It's an financial analytics app that seeks to get insight from investment decisions and data from SEC 13F filings.

## Bug fixing guidelines
- When I report a bug, don't start by trying to fix it. Instead, use red/green TDD approach. Start by writing a test that reproduces the bug. Then, try to fix the bug and prove it with a passing test.

## Testing
Review, analyse, fix and self test. Use agent-browser tool to test UI. Interact with the app on different routes. Especially the one where the error is produced. Use UI components like search box (produces result list, search works and clicks navigate to correct page with no errors), tables and charts are visible and with data. Use red/green TDD approach. Declare the issue fixed only when the originally failed tests pass and there are no:
- no browser console errors in the automated browser checks
- no page errors in the automated browser checks
- no server errors in the fresh verification runs


## Tech Stack and javascript runtime 
- **bun** as package manager, js runtime, bundler and test runner. Never use node.js 
- **bun** rules url - https://bun.com/llms-rules.txt
- **bun** docs - https://bun.sh/llms.txt
- **bun** docs full - https://bun.sh/llms-full.txt
- **zero** sync docs - https://zero.rocicorp.dev/llms.txt
- **zero** sync full docs - https://zero.rocicorp.dev/llms-full.txt
- **hono** docs - https://hono.dev/llms.txt
- **hono** full docs - https://hono.dev/llms-full.txt

## Drizzle ORM for schema management and migrations
- Drizzle llm docs - https://orm.drizzle.team/llms.txt
- Drizzle llm docs Full - https://orm.drizzle.team/llms-full.txt

## Analytics and main DB is Duckdb
1. Duckdb docs - https://duckdb.org/llms.txt
2. Main data is stored in the **duckdb** DB in a local under variable **DUCKDB_PATH** in .env
3. Transaction and Master data in **parquet** files in the directory **APP_DATA_PATH** in .env
4. **TanStack DB** for a reactive, client-first store for API data with collections, live queries and optimistic mutations that keep UI reactive. It's used in conjuntion with Dexie.js and IndexedDB



### Key Commands
```bash

bun run dev:db-up             # to start the dev Postgres container
bun run dev:db-down           # to stop the dev Postgres container
bun run dev:clean             # to delete data volumes Posgtres (use after stopping db)
bun run db:generate           # Generate Drizzle migration only
bun run db:migrate            # Apply migrations to database only
bun run dev                   # launches the web app

```
