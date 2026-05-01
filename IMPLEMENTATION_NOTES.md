# Implementation Notes

## Curation Rules
- Re-prioritize on every read.
- Keep recurring, high-value notes only.
- Max 10 items per category.
- Each item includes date + "Do instead".

## Search Architecture & Performance
1. **[2026-04-20] Keep global search on the shared uFuzzy engine**
   Do instead: implement navbar/entity search behavior in `src/components/UFuzzyGlobalSearch.tsx` and reuse helpers from `src/lib/ufuzzy-search.ts` rather than adding a second client-side search engine.
2. **[2026-04-20] Use table-local uFuzzy only through `VirtualDataTable`**
   Do instead: enable fuzzy matching for large local tables by passing `searchStrategy="ufuzzy"` to `src/components/VirtualDataTable.tsx` instead of duplicating search logic inside each page component.
3. **[2026-04-20] Assets and superinvestors tables are the current uFuzzy table surfaces**
   Do instead: keep `src/pages/AssetsTable.tsx` and `src/pages/SuperinvestorsTable.tsx` on `VirtualDataTable` with `searchStrategy="ufuzzy"` so typo-tolerant local filtering stays shared and consistent.
4. **[2026-04-20] Drilldown search should remain simple local filtering unless requirements change**
   Do instead: leave `src/components/InvestorActivityDrilldownTable.tsx` on the default includes-based `VirtualDataTable` search path unless there is an explicit reason to add fuzzy matching there.
5. **[2026-05-01] Use both memory benchmarks before changing search/table architecture**
   Do instead: run `bun run benchmark:memory --base-url http://127.0.0.1:4002 --route /superinvestors/716851 --headed --delay-ms 1000 --disable-react-scan` and `bun run benchmark:memory:tooltip --base-url http://127.0.0.1:4002 --route /superinvestors/716851 --delay-ms 1000 --tooltip-delay-ms 2200 --disable-react-scan` to compare process RSS against Chrome tab-tooltip memory after the shared 10-step interaction sequence without dev profiler overhead.

## Alerting & Incident Routing
1. **[2026-05-01] Keep web-app Telegram alerts separate from `sec_app`**
   Do instead: route this repo only through `WEB_APP_APPRISE_DEV_URLS` and `WEB_APP_APPRISE_PROD_URLS`; never fall back to `SEC_APP_APPRISE_URLS` or send web incidents into `[SEC_APP]` channels.
2. **[2026-05-01] Use Apprise-style Telegram URLs without adding Apprise**
   Do instead: keep the consolidated URL shape `tgram://<bot-token>/<chat-id>` but parse and send through `api/telegram-alerts.ts` using Telegram Bot API directly, so the web app mirrors `sec_app` conventions without a new runtime dependency.
3. **[2026-05-01] Web app alert channels are dedicated**
   Do instead: store the dedicated `web_app_alerts_bot` destinations in ignored `.env` and GitHub Actions secrets as `WEB_APP_APPRISE_DEV_URLS` for `[WEB_APP][DEV] alerts` and `WEB_APP_APPRISE_PROD_URLS` for `[WEB_APP][PROD] alerts`; do not commit token or chat IDs.
4. **[2026-05-01] Telegram channels require bot admin rights**
   Do instead: before diagnosing app code, verify the bot is admin in the target channel; Telegram returns `Bad Request: need administrator rights in the channel chat` when the URL/chat ID is correct but permissions are missing.
5. **[2026-05-01] Test both alert environments explicitly**
   Do instead: run `WEB_APP_ALERT_ENV=dev ... bun scripts/telegram-notify.ts` and `WEB_APP_ALERT_ENV=prod ... bun scripts/telegram-notify.ts`; both should print `Telegram alert sent.` and land in their respective `[WEB_APP]` channels.
6. **[2026-05-01] Runtime errors have two alert entry points**
   Do instead: keep server exceptions wired through `app.onError` in `api/index.ts`, and browser `window.error`/`unhandledrejection` events posted to `/api/client-errors` from `src/lib/error-tracking.ts`.

## Readiness & Repository Hygiene
1. **[2026-05-01] Keep `.env` ignored and untracked**
   Do instead: use `infra/prod/.env.example` for shared variable shape and local ignored `.env`/GitHub secrets for real values; never re-track `.env`.
2. **[2026-05-01] Stage docs/factory readiness reports intentionally**
   Do instead: include generated `docs/factory/readiness_report_*.md` when the user asks to preserve readiness artifacts, but strip trailing whitespace before committing.
3. **[2026-05-01] Preserve unrelated external edits while committing fixes**
   Do instead: stage only the files for the current fix when other files show external edits, then report remaining unstaged files explicitly.
4. **[2026-05-01] Validate alerting changes before commit**
   Do instead: run `bun test api/telegram-alerts.test.ts`, `bun run typecheck`, `bun run format:check`, `bun run lint`, and `bun run readiness:quality`; add `bun run test:ci`/`bun run build` when alerting touches runtime or frontend paths.
