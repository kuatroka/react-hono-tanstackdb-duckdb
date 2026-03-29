# Forge Implementation Brief — Bun-Only Migration (Server-First, Red/Green TDD)

## Objective

Migrate the repo from Vite-based frontend dev/build to a Bun-only architecture using a single Bun server for API + SPA, while preserving current app behavior, Zero integration, SPA routing, relative API requests, and CSS output.

## TDD Strategy

Use a strict red/green/refactor sequence for each migration slice:

1. **Red**: add or update an automated test that captures the current requirement or reproduces the Bun-only gap.
2. **Green**: make the minimum production change required to satisfy that test.
3. **Refactor**: clean up implementation details only after the new test passes.
4. **Verify**: rerun the focused test first, then rerun the broader build/test checks affected by the change.

Do not remove Vite runtime/build dependencies until Bun dev/build parity is proven by passing checks.

## Red/Green Implementation Plan

- [x] Phase 1. **Red**: add server-focused tests that define Bun server behavior for API passthrough, static asset serving, asset 404 behavior, and SPA fallback for non-asset client routes.
- [x] Phase 2. **Green**: update `api/server.ts` so Bun serves both API and SPA routes in development and production, using `dist` assets when present and falling back correctly for SPA routes.
- [x] Phase 3. **Refactor/Verify**: simplify any route/asset helper logic in the Bun server once the new server behavior tests pass.

- [x] Phase 4. **Red**: add script/config tests that fail if local development still depends on Vite or does not start the Bun app server, Zero, and required CSS watch process.
- [x] Phase 5. **Green**: update `package.json` so local development no longer starts Vite and instead starts the Bun server, Zero, and CSS watch flow.
- [x] Phase 6. **Refactor/Verify**: tighten script naming and orchestration only after script-level checks pass.

- [x] Phase 7. **Red**: add tests for an explicit Bun-driven CSS pipeline covering build output generation and watch-mode entry points.
- [x] Phase 8. **Green**: add `scripts/build-css.ts` and wire it into package scripts using PostCSS, Tailwind, and autoprefixer.
- [x] Phase 9. **Refactor/Verify**: clean up CSS script ergonomics only after focused CSS checks pass.

- [x] Phase 10. **Red**: add build verification that fails if production build still invokes Vite or if Bun-generated SPA output is not served correctly.
- [x] Phase 11. **Green**: replace the Vite production build command with Bun HTML-entry bundling and add a post-build HTML normalization step only if Bun output requires it.
- [~] Phase 12. **Refactor/Verify**: remove any temporary build glue only after Bun build output is validated.

- [ ] Phase 13. **Red**: add frontend configuration tests that fail on direct `import.meta.env.VITE_*` dependency while preserving current Zero/query endpoint defaults.
- [ ] Phase 14. **Green**: refactor frontend runtime configuration so it no longer depends directly on `import.meta.env.VITE_*`.
- [ ] Phase 15. **Refactor/Verify**: remove transitional config code only after frontend config checks pass.

- [ ] Phase 16. **Red**: add or update type-check coverage proving the frontend no longer requires Vite ambient types.
- [ ] Phase 17. **Green**: remove `src/vite-env.d.ts` or replace it with Bun-compatible types only if still needed.
- [ ] Phase 18. **Refactor/Verify**: confirm type-check/build still pass without Vite ambient globals.

- [ ] Phase 19. **Red**: extend startup guard tests so they fail if messaging or required ports still describe the old Vite topology.
- [ ] Phase 20. **Green**: update `scripts/startup-port-guard.mjs` messaging and required ports to match the Bun-only architecture.
- [ ] Phase 21. **Refactor/Verify**: clean up port-guard wording/structure after tests pass.

- [ ] Phase 22. **Red**: run the full Bun-only verification suite and confirm `vite.config.ts` and Vite-only packages are no longer required by any passing check.
- [ ] Phase 23. **Green**: remove `vite.config.ts` and Vite-only dependencies only after Bun dev/build parity is verified.
- [ ] Phase 24. **Refactor/Verify**: perform final cleanup of unused Vite references and rerun the final verification set.

## File-by-File TDD Task List

- [ ] `api/server.ts`: first add server behavior tests, then expand from API-only Bun server to single Bun server for API + SPA + production static files.
- [ ] `package.json`: first add script/build assertions, then remove Vite from active scripts and add Bun-only dev/build/CSS scripts while keeping Zero orchestration intact.
- [ ] `scripts/build-css.ts`: add only after CSS pipeline tests define required build/watch behavior.
- [ ] `index.html`: adjust script/style references only if Bun build tests prove it is required.
- [ ] `src/main.tsx`: first add config-focused tests, then replace direct Vite env access with Bun-compatible frontend config handling.
- [ ] `src/vite-env.d.ts`: remove or replace only after type-check coverage proves it is unnecessary.
- [ ] `scripts/startup-port-guard.mjs`: first update tests, then remove Vite terminology and align required ports with the final Bun topology.
- [ ] `vite.config.ts`: delete only after the final red/green verification proves no remaining dependency.
- [ ] `package.json` dependencies: remove Vite-only packages last, after all tests/build checks pass.

## Verification Gates

### Focused Red/Green Gates

- [ ] Server behavior tests fail before the Bun SPA server refactor and pass after it.
- [ ] Script/orchestration checks fail before package script changes and pass after them.
- [ ] CSS pipeline tests fail before explicit CSS build/watch wiring and pass after it.
- [ ] Production build verification fails before Bun build migration and passes after it.
- [ ] Frontend config tests fail before env refactor and pass after it.
- [ ] Startup guard tests fail before messaging/port updates and pass after them.

### Final Parity Gates

- [ ] Bun serves API routes and SPA routes without any Vite dev server.
- [ ] Relative API requests such as `/api/login` continue to work.
- [ ] SPA deep-link refresh works for app routes.
- [ ] CSS renders correctly in development and production.
- [ ] Production build no longer invokes Vite.
- [ ] Frontend runtime config works without direct `import.meta.env.VITE_*` dependency.
- [ ] Startup guard no longer refers to Vite.
- [ ] `vite.config.ts` is no longer required.
- [ ] Final targeted tests and relevant build/type-check commands pass under Bun.

## Potential Risks and TDD Mitigations

1. **Server migration breaks SPA route handling**  
   Mitigation: write fallback/static/API route tests first, then change server behavior.
2. **CSS output diverges under Bun**  
   Mitigation: define CSS build/watch expectations in tests before changing pipeline wiring.
3. **Frontend env refactor changes endpoint behavior**  
   Mitigation: lock existing defaults in tests before replacing `import.meta.env.VITE_*` usage.
4. **Cleanup reveals hidden Vite coupling**  
   Mitigation: keep Vite config/dependencies until the final parity checks prove they are unused.

## Alternative Approaches

1. Single Bun server for API + SPA: recommended, simplest long-term architecture.
2. Separate Bun UI server + Bun API server: preserves port split but adds unnecessary complexity.
3. Build-first migration: simpler to start, but rejected because it delays the requested red/green TDD migration flow.

