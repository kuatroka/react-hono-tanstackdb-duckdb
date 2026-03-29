# Rerender Isolation Design

Date: 2026-03-29
Status: Approved for planning
Topic: Eliminate unnecessary React rerenders across search, charts, tables, and route surfaces while preserving the current UI.

## Goal

Reduce unnecessary rerenders across the application so that interacting with one surface only rerenders that surface and its direct dependents. The visible UI should remain the same.

Primary target behaviors:
- Typing in global search must not rerender unrelated route content.
- Typing in page-local search surfaces must not rerender unrelated charts, tables, or route shells.
- Chart hover and click interactions must not rerender unrelated sibling surfaces.
- Heavy tables and charts should rerender only when their own data or direct interaction state changes.

## Chosen approach

Use a route-level state partitioning overhaul.

This means restructuring the app into independent reactive islands:
- Route shells become thin layout and route-param readers.
- Search, charts, flow charts, drilldown tables, and latency badges own their own state and subscriptions.
- Typing, hover, selection, loading, and render-timing state stay local to the surface that uses them.
- Shared parents pass stable identifiers such as `ticker`, `cusip`, `cik`, `quarter`, and `action`, rather than large derived arrays or rapidly changing inline callbacks.

## Alternatives considered

### Option A — Leaf-state isolation with memoized heavy surfaces
Keep the current route structure, move hot state lower, and memoize heavy children.

Why not chosen:
- Lower risk, but not strong enough for the requested “fix all unnecessary rerenders” goal.
- Leaves broad route ownership patterns in place, which are likely a root cause of cross-surface rerenders.

### Option B — Narrow collection subscriptions per route/surface
Retain route structure but move broad TanStack DB subscriptions into narrower surface-local subscriptions.

Why not chosen:
- Valuable, and some of it will still be part of the final implementation.
- But by itself it does not go as far as the user requested; it improves subscriptions without fully redesigning ownership boundaries.

### Option C — Route-level state partitioning overhaul
Reorganize each route so every heavy interactive surface owns its own state, subscriptions, and timing behavior.

Why chosen:
- Best match for the user’s explicit preference.
- Strongest isolation for search, charts, tables, and drilldowns.
- Best long-term structure for performance-sensitive TanStack DB UI work.

## Architecture

The application will be refactored into performance boundaries with explicit ownership.

### Rule 1 — Search state stays inside search surfaces only
Search components own:
- query text
- open/closed state
- highlighted result state
- search index loading state
- API fallback state
- local latency state

Search components do not push that state into route shells or shared layout parents.

### Rule 2 — Heavy surfaces subscribe and render independently
Each heavy surface owns its own data subscription and render timing state:
- activity charts
- flow charts
- drilldown tables
- portfolio history charts
- page-local search surfaces
- latency badges tied to a specific surface

A sibling surface changing should not force rerendering unless the sibling’s props actually change.

### Rule 3 — Route pages become layout shells
Route pages should primarily:
- read route params
- fetch minimal identity-level page data needed for framing
- render independent surface sections

Route pages should not be the main owners of broad collection subscriptions plus multiple unrelated pieces of transient UI state.

## Planned component boundaries

### Global navigation and global search
Current hot path:
- `app/components/global-nav.tsx`
- `src/components/DuckDBGlobalSearch.tsx`

Target design:
- `GlobalNav` remains mostly layout and active-link rendering.
- `DuckDBGlobalSearch` becomes a smaller coordinator.
- Split the search into focused internal boundaries such as:
  - search input/controller
  - results list
  - latency display
- Keep input and dropdown state fully inside the search subtree.
- Stabilize handlers and result row props so highlight movement or query updates do not disturb unrelated nav content.

### Asset detail route
Current hot path:
- `src/pages/AssetDetail.tsx`

Target design:
- Asset detail page becomes a shell that reads route params and minimal asset record data for page framing.
- Extract independent route sections such as:
  - `ActivityChartsSection`
  - `InvestorFlowSection`
  - `DrilldownInteractionSection`
- Each section owns:
  - its own `useLiveQuery` subscription
  - its own loading state
  - its own render timing state
  - its own interaction callbacks
- Click-based and hover-based drilldown tables become isolated children so hover changes do not cause unrelated chart or table work.

### Superinvestor detail route
Current hot path:
- `src/pages/SuperinvestorDetail.tsx`

Target design:
- Superinvestor detail page becomes a shell responsible only for route params, minimal record fetch, and framing.
- Extract an independent chart section such as `PortfolioHistorySection`.
- That section owns:
  - quarterly data subscription
  - loading state
  - render timing state
  - chart-specific latency badge state

### Heavy visual components
Relevant heavy surfaces include:
- `src/components/charts/InvestorActivityUplotChart.tsx`
- `src/components/charts/InvestorActivityEchartsChart.tsx`
- `src/components/charts/InvestorFlowChart.tsx`
- `src/components/InvestorActivityDrilldownTable.tsx`

Target design:
- These receive only stable props.
- They are memoized where memoization blocks real unnecessary rerenders.
- They stop depending on high-churn parent-owned JSX or callback identities.

## Data flow design

### Route shell data
Route shells keep only minimal route-framing data, such as:
- route params
- page identity record needed for title and back-link rendering

They do not own broad collection subscriptions for every heavy surface on the page.

### Surface-local subscriptions
Each heavy surface subscribes only to the data it needs.

Examples:
- activity chart section owns activity collection access
- flow section owns flow collection access
- drilldown section owns drilldown collection access
- portfolio chart section owns quarterly collection access

Derived filtering and sorting happen close to the subscribing surface rather than high in the route page.

### Stable prop contract
Parents should pass:
- primitive identifiers
- explicit stable configuration values
- stable callbacks only when needed

Parents should avoid passing:
- freshly built arrays from the route page when the child can derive them itself
- freshly built latency badge JSX on every render
- transient state that only one child actually uses

### Latency and render timing ownership
Latency and render-timing state move beside the surface they describe.
This prevents a timing update in one chart or table from rerendering sibling surfaces.

### Search-specific data flow
Global and page-local search should:
- own all typing and dropdown state locally
- keep index/bootstrap/loading logic inside the search subtree
- navigate without causing unrelated page content churn before route transition

## Error handling and behavior constraints

Visible behavior must remain unchanged:
- same page structure
- same navigation behavior
- same charts, tables, and search results
- same loading semantics unless a small internal change is required to preserve isolation

Allowed internal changes:
- reshaping component boundaries
- changing prop APIs
- moving subscriptions and state downwards
- replacing inline JSX props with local rendering inside sections
- memoization and callback stabilization

Not in scope:
- redesigning the UI
- changing core product behavior
- adding new features unrelated to rerender isolation

## Testing strategy

This work must follow the project’s red/green TDD and verification rules.

### Code-level regression coverage
Before refactoring, add or extend tests that capture the affected hot paths where practical:
- search behavior
- extracted section behavior
- any state logic that becomes independently testable during refactor

The tests do not need to assert React internals directly unless the codebase already has a pattern for that. They should protect behavior while refactoring the component boundaries.

### Browser verification
Because rerender isolation is a runtime behavior, browser verification is required.
Use agent-browser and the installed react-scan tooling to verify:
- global search on all major routes
- asset detail interactions
- superinvestor detail interactions
- page-local search interactions
- chart hover and click interactions
- drilldown table interactions

### Acceptance criteria
The work is complete when all of the following are true:
- Typing in global search no longer rerenders unrelated route content.
- Typing in asset and superinvestor page search surfaces no longer rerenders unrelated charts, tables, or route shells.
- Hovering or clicking a chart rerenders only the relevant chart/drilldown/search surface.
- Route shells stay visually the same.
- Relevant Bun tests pass.
- Browser validation shows no browser console errors.
- Browser validation shows no page errors.
- Fresh verification runs show no server errors.

## Implementation guidance for the upcoming plan

The implementation plan should prioritize the highest-churn surfaces first:
1. global search and navigation subtree
2. asset detail route partitioning
3. superinvestor detail route partitioning
4. memoization and prop stabilization for remaining heavy chart/table surfaces
5. route-by-route browser verification with react-scan

The plan should also explicitly call out which new or updated tests will be written before each bug fix/refactor step where practical.
