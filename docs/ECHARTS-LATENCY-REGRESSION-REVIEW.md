# ECharts Latency Regression Review

Date: 2026-04-08

## Scope
- Route under review: `http://localhost:4002/assets/NDN/65440K106`
- Plan inputs:
  - `.omx/plans/prd-echarts-latency-regression.md`
  - `.omx/plans/test-spec-echarts-latency-regression.md`
- Reference implementation: `src/components/charts/CikValueEchartsChart.tsx`

## Review Summary
The current asset-detail ECharts regression is still reproducible at the source-contract level. The shared timing contract test is red because `OpenedClosedBarChart.tsx` and `InvestorFlowChart.tsx` still use the older synchronous completion path instead of the deferred render-completion helper already used by `CikValueEchartsChart.tsx`.

## Code Review Findings

### 1. `OpenedClosedBarChart.tsx` still uses a React size state in the render path
Current code stores `{ width, height }` in React state and re-renders when the `ResizeObserver` fires. That introduces an avoidable two-phase mount/update path on the hot route.

**Why this matters**
- It adds React work to what should be an imperative ECharts resize path.
- It makes initial sizing depend on a state update before the chart can fully settle.
- It diverges from the already-working `CikValueEchartsChart.tsx` pattern.

### 2. `OpenedClosedBarChart.tsx` still measures render completion synchronously
The file still computes elapsed time immediately after `setOption` by calling `performance.now()` directly in the effect.

**Why this matters**
- It does not wait for ECharts to finish layout and paint scheduling.
- It violates the shared contract encoded in `src/components/charts/renderTiming.test.ts`.
- It can report optimistic latency while the route still feels slow.

### 3. `InvestorFlowChart.tsx` repeats the same lifecycle regression
`InvestorFlowChart.tsx` still keeps `chartSize` in React state and still derives completion synchronously from the same effect cycle.

**Why this matters**
- The route-level slowdown is likely shared across both ECharts surfaces.
- Fixing only one chart would leave the route with mixed lifecycle behavior.
- The plan specifically calls for aligning both chart files to the shared deferred-completion approach.

### 4. `CikValueEchartsChart.tsx` is the in-repo reference pattern
`CikValueEchartsChart.tsx` already demonstrates the desired lifecycle:
- no React chart-size state in the render path,
- imperative `ResizeObserver` resizing,
- `createDeferredRenderCompletion(...)`, and
- `renderCompletion.schedule()` from the ECharts finished path.

### 5. Current red-test evidence matches the review
The focused contract test still fails before the fix, which is the expected red phase for this regression.

Observed failure summary:
- `bun test src/components/charts/renderTiming.test.ts`
- failure reason: `OpenedClosedBarChart.tsx` does not yet contain `createDeferredRenderCompletion`

## Lifecycle Parity Snapshot

| File | React-managed chart size state | Deferred render completion helper | Inline post-`setOption` timing | Notes |
| --- | --- | --- | --- | --- |
| `src/components/charts/OpenedClosedBarChart.tsx` | Yes (`80-117`) | No | Yes (`264-268`) | Also keeps click/hover listeners inside the main render/update effect (`271-309`). |
| `src/components/charts/InvestorFlowChart.tsx` | Yes (`81-128`) | No | Yes (`243-248`) | The chart waits on `chartSize` before setup (`225-259`). |
| `src/components/charts/CikValueEchartsChart.tsx` | No | Yes (`186-206`) | No | This is the reference lifecycle, with imperative resize handling at `210-220`. |

## Baseline Verification Snapshot
- `bun test src/components/charts/renderTiming.test.ts` **FAIL** — the contract test is red because `OpenedClosedBarChart.tsx` still lacks `createDeferredRenderCompletion`.
- `bunx tsc --noEmit` **PASS** — TypeScript completes cleanly in the current branch.
- `bun run lint` **FAIL** — repo-wide pre-existing lint issues exist outside this task scope (for example `api/bun-native-benchmark.ts`, `src/pages/AssetDetail.sections.test.tsx`, and `src/pages/SuperinvestorDetail.sections.test.tsx`).

## Required Final-State Contract
The implementation is ready for sign-off only when all of the following are true:

1. `OpenedClosedBarChart.tsx` imports and uses `createDeferredRenderCompletion`.
2. `InvestorFlowChart.tsx` imports and uses `createDeferredRenderCompletion`.
3. Both charts schedule completion with `renderCompletion.schedule()` instead of calculating elapsed time inline after `setOption`.
4. Both charts resize imperatively from the DOM/observer path instead of gating chart setup on React-managed `chartSize` state.
5. Existing click/hover/globalout interactions remain intact.
6. `src/components/charts/renderTiming.test.ts` passes green.

## Verification Checklist

### Focused contract tests
```bash
bun test src/components/charts/renderTiming.test.ts
```

### Static verification
```bash
bun run lint
bunx tsc --noEmit
```

### Browser/runtime verification
After the implementation lane lands, verify:
1. Start the app with Bun.
2. Load `http://localhost:4002/assets/NDN/65440K106` fresh.
3. Confirm the page remains responsive while ECharts panels load.
4. Compare the `Investor Activity (ECharts)` latency badge against the uPlot panel.
5. Hover and click chart bars to confirm drilldown behavior still works.
6. Confirm zero fresh browser console errors, page errors, and server errors.

## Reviewer Notes For Integration
- Prefer copying the `CikValueEchartsChart.tsx` lifecycle pattern over introducing a new abstraction.
- Keep the diff scoped to the known ECharts regression path.
- Preserve chart appearance and interaction semantics while changing timing/resize behavior.
- Treat browser responsiveness as the real acceptance gate, not just the badge.
