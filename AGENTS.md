## Your goal and job is to ruthlessly find most optimal and performant solution for a feature, bug fix or any given task. Use deep research, innovation, analysis. Think from first principles. Non-conventional approach that is extra performant is always better than a standard existing and well established one. It does not mean you should discard existing best practices, but you are totally free to propose anything as long as it's better than the existing classic, conventional wisdom solution.
Always opted for the best possible and performant long term solution instead of a quick transactional fix. 

Don't just agree with me, feel totally free to correct me when I'm wrong or ask me questions if you feel you need more clarity on the intent


## Project
This a Tanstack React (frontend) + hono (backend) + **TanStack DB** + **duckdb** project. It's an financial analytics app that seeks to get insight from investment decisions and data from SEC 13F filings.

## Git
- Commit very often so we can rever to a prior codebase. Commit every 10 min

## Bug fixing guidelines
- When I report a bug, don't start by trying to fix it. Instead, use red/green TDD approach. Start by writing a test that reproduces the bug. Then, try to fix the bug and prove it with a passing test.

## Testing
Review, analyse, fix and self test. Use agent-browser tool to test UI. Interact with the app on different routes. Especially the one where the error is produced. Use UI components like search box (produces result list, search works and clicks navigate to correct page with no errors), tables and charts are visible and with data. Use red/green TDD approach. Declare the issue fixed only when the originally failed tests pass and there are no:
- no browser console errors in the automated browser checks
- no page errors in the automated browser checks
- no server errors in the fresh verification runs
- use react-scanner in dev to check unnecessary rerenders of unrelated ui components


## Tech Stack and javascript runtime 
- **bun** as package manager, js runtime, bundler and test runner. Never use node.js. Instead of command 'npm' use 'bun', instead of 'npx' use 'bunx'
- **bun** rules url - https://bun.com/llms-rules.txt
- **bun** docs - https://bun.sh/llms.txt
- **bun** docs full - https://bun.sh/llms-full.txt
- **hono** docs - https://hono.dev/llms.txt
- **hono** full docs - https://hono.dev/llms-full.txt

## Analytics and main DB is Duckdb
1. Duckdb docs - https://duckdb.org/llms.txt
2. Main data is stored in the **duckdb** DB in a local under variable **DUCKDB_PATH** in .env
3. Transaction and Master data in **parquet** files in the directory **APP_DATA_PATH** in .env
4. **TanStack DB** for a reactive, client-first store for API data with collections, live queries and optimistic mutations that keep UI reactive. It's used in conjuntion with Dexie.js and IndexedDB



### Key Commands
```bash

bun run dev                   # launches the web app
bun run build                 # builds the web app
bun run start                 # starts the production server
bun run benchmark:duckdb      # runs the DuckDB native benchmark

```
