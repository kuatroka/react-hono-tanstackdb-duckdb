/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import * as assetActivityModule from "@/collections/asset-activity";
import * as collectionsModule from "@/collections";
import * as investorFlowModule from "@/collections/investor-flow";
import * as investorDetailsModule from "@/collections/investor-details";
import * as pageCacheCleanupModule from "@/collections/page-cache-cleanup";

type InvestorActivityAction = "open" | "close";

interface ActivityRow {
  ticker: string;
  cusip: string | null;
  quarter: string;
  numOpen: number;
  numClose: number;
}

interface HookHarness {
  render: () => unknown;
  flushEffects: () => void;
  settle: () => unknown;
  unmount: () => void;
  getStateUpdatesAfterUnmount: () => Array<{ index: number; value: unknown }>;
}

let currentActivityRows: ActivityRow[] = [];
let currentFlowRows: Array<{ ticker: string; quarter: string }> = [];
const eagerLoadCalls: Array<{ code: string; cusip: string; quarter: string }> = [];
const backgroundLoadCalls: Array<{ code: string; cusip: string; excluded: string[] }> = [];
const cleanupCalls: string[] = [];
let currentFetchAssetActivityData: (code: string, cusip?: string | null) => Promise<any> = async () => ({ rows: [], queryTimeMs: 0, source: "memory" });
let currentFetchInvestorFlowData: (code: string) => Promise<any> = async () => ({ rows: [], queryTimeMs: 0, source: "memory" });
let currentFetchDrilldownBothActions: (code: string, cusip: string, quarter: string) => Promise<void> = async () => undefined;
let currentBackgroundLoadAllDrilldownData: (
  code: string,
  cusip: string,
  excluded: string[],
  onProgress: (loaded: number, total: number) => void,
) => Promise<void> = async () => undefined;

function registerModuleMocks() {
  mock.module("@tanstack/react-db", () => ({
    useLiveQuery: (query: (q: { from: ({ rows }: { rows: unknown }) => unknown }) => unknown) => {
      let requestedRows: unknown;
      query({
        from: ({ rows }) => {
          requestedRows = rows;
          return rows;
        },
      });
      if (requestedRows === collectionsModule.investorFlowCollection) {
        return { data: currentFlowRows };
      }
      if (requestedRows === collectionsModule.assetActivityCollection) {
        return { data: currentActivityRows };
      }
      return { data: [] };
    },
  }));

  spyOn(assetActivityModule, "fetchAssetActivityData").mockImplementation(
    ((code: string, cusip?: string | null) => currentFetchAssetActivityData(code, cusip)) as any,
  );

  spyOn(assetActivityModule, "getAssetActivityFromCollection").mockImplementation(
    ((code: string, cusip?: string | null) => currentActivityRows.filter((row) => {
      if (row.ticker !== code) return false;
      if (cusip == null) return row.cusip == null;
      return row.cusip === cusip;
    })) as any,
  );

  spyOn(investorFlowModule, "fetchInvestorFlowData").mockImplementation(
    ((code: string) => currentFetchInvestorFlowData(code)) as any,
  );

  spyOn(investorFlowModule, "getInvestorFlowFromCollection").mockImplementation(
    ((code: string) => currentFlowRows.filter((row) => row.ticker === code)) as any,
  );

  mock.module("@/components/InvestorActivityDrilldownTable", () => ({
    InvestorActivityDrilldownTable: (props: {
      ticker: string;
      cusip: string;
      quarter: string;
      action: InvestorActivityAction;
    }) => React.createElement("div", props),
  }));

  spyOn(investorDetailsModule, "fetchDrilldownBothActions").mockImplementation(((code: string, cusip: string, quarter: string) => {
    eagerLoadCalls.push({ code, cusip, quarter });
    return currentFetchDrilldownBothActions(code, cusip, quarter);
  }) as any);
  spyOn(investorDetailsModule, "backgroundLoadAllDrilldownData").mockImplementation(((
    code: string,
    cusip: string,
    excluded: string[],
    onProgress: (loaded: number, total: number) => void,
  ) => {
    backgroundLoadCalls.push({ code, cusip, excluded });
    return currentBackgroundLoadAllDrilldownData(code, cusip, excluded, onProgress);
  }) as any);

  spyOn(pageCacheCleanupModule, "clearAssetDetailRouteCaches").mockImplementation(() => {
    cleanupCalls.push("cleared");
  });

  mock.module("@/components/charts/InvestorActivityUplotChart", () => ({
    InvestorActivityUplotChart: () => React.createElement("div", null, "uplot-chart"),
  }));

  mock.module("@/components/charts/InvestorActivityEchartsChart", () => ({
    InvestorActivityEchartsChart: () => React.createElement("div", null, "echarts-chart"),
  }));

  mock.module("@/components/charts/InvestorFlowChart", () => ({
    InvestorFlowChart: () => React.createElement("div", null, "flow-chart"),
    InvestorFlowUplotChart: () => React.createElement("div", null, "flow-uplot-chart"),
  }));
}

function depsChanged(prev: unknown[] | undefined, next: unknown[] | undefined) {
  if (!prev || !next) return true;
  if (prev.length !== next.length) return true;
  return next.some((value, index) => !Object.is(value, prev[index]));
}

function createHookHarness(component: (props: any) => unknown, props: any): HookHarness {
  const hookState: unknown[] = [];
  const hookDeps: Array<unknown[] | undefined> = [];
  const hookCleanups: Array<(() => void) | undefined> = [];
  const stateUpdatesAfterUnmount: Array<{ index: number; value: unknown }> = [];
  let hookIndex = 0;
  let pendingEffects: Array<() => void> = [];
  let scheduledUpdate = false;
  let latestTree: unknown;
  let mounted = true;

  const actualReact = React;

  mock.module("react", () => ({
    ...actualReact,
    memo: (component: any) => component,
    useState<T>(initial: T | (() => T)) {
      const stateIndex = hookIndex++;
      if (!(stateIndex in hookState)) {
        hookState[stateIndex] = typeof initial === "function" ? (initial as () => T)() : initial;
      }
      const setState = (next: T | ((current: T) => T)) => {
        const current = hookState[stateIndex] as T;
        const resolved = typeof next === "function" ? (next as (current: T) => T)(current) : next;
        if (!mounted) {
          stateUpdatesAfterUnmount.push({ index: stateIndex, value: resolved });
          return;
        }
        if (!Object.is(current, resolved)) {
          hookState[stateIndex] = resolved;
          scheduledUpdate = true;
        }
      };
      return [hookState[stateIndex] as T, setState] as const;
    },
    useRef<T>(initial: T) {
      const refIndex = hookIndex++;
      if (!(refIndex in hookState)) {
        hookState[refIndex] = { current: initial };
      }
      return hookState[refIndex] as { current: T };
    },
    useMemo<T>(factory: () => T, deps?: unknown[]) {
      const memoIndex = hookIndex++;
      const current = hookState[memoIndex] as { deps?: unknown[]; value: T } | undefined;
      if (current && !depsChanged(current.deps, deps)) {
        return current.value;
      }
      const value = factory();
      hookState[memoIndex] = { deps, value };
      return value;
    },
    useCallback<T extends (...args: any[]) => any>(callback: T, deps?: unknown[]) {
      const callbackIndex = hookIndex++;
      const current = hookState[callbackIndex] as { deps?: unknown[]; value: T } | undefined;
      if (current && !depsChanged(current.deps, deps)) {
        return current.value;
      }
      hookState[callbackIndex] = { deps, value: callback };
      return callback;
    },
    useEffect(effect: () => void | (() => void), deps?: unknown[]) {
      const effectIndex = hookIndex++;
      if (!depsChanged(hookDeps[effectIndex], deps)) {
        return;
      }
      hookDeps[effectIndex] = deps;
      pendingEffects.push(() => {
        hookCleanups[effectIndex]?.();
        const cleanup = effect();
        hookCleanups[effectIndex] = typeof cleanup === "function" ? cleanup : undefined;
      });
    },
  }));

  const render = () => {
    hookIndex = 0;
    pendingEffects = [];
    latestTree = component(props);
    return latestTree;
  };

  const flushEffects = () => {
    const effects = pendingEffects;
    pendingEffects = [];
    for (const effect of effects) {
      effect();
    }
  };

  const settle = () => {
    render();
    flushEffects();
    while (scheduledUpdate) {
      scheduledUpdate = false;
      render();
      flushEffects();
    }
    return latestTree;
  };

  const unmount = () => {
    mounted = false;
    for (const cleanup of hookCleanups) {
      cleanup?.();
    }
  };

  const getStateUpdatesAfterUnmount = () => stateUpdatesAfterUnmount;

  return { render, flushEffects, settle, unmount, getStateUpdatesAfterUnmount };
}

function collectElements(tree: any, predicate: (node: any) => boolean, results: any[] = []) {
  if (tree == null || typeof tree === "boolean") {
    return results;
  }

  if (Array.isArray(tree)) {
    for (const child of tree) {
      collectElements(child, predicate, results);
    }
    return results;
  }

  if (typeof tree === "object" && "type" in tree && "props" in tree) {
    if (predicate(tree)) {
      results.push(tree);
    }
    collectElements(tree.props?.children, predicate, results);
  }

  return results;
}

function getDrilldownDetailsPanels(tree: unknown) {
  return collectElements(
    tree,
    (node) => typeof node.type === "function" && node.type.name === "AssetDrilldownDetailsPanel",
  );
}

describe("asset detail section runtime behavior", () => {
  afterEach(() => {
    mock.restore();
  });

  test("ignores background drilldown progress updates after unmount", async () => {
    currentActivityRows = [
      { ticker: "ABC", cusip: "12345678", quarter: "2024-Q4", numOpen: 4, numClose: 0 },
    ];

    let capturedOnProgress: ((loaded: number, total: number) => void) | null = null;
    currentFetchDrilldownBothActions = async () => undefined;
    currentBackgroundLoadAllDrilldownData = async (_code, _cusip, _excluded, onProgress) => {
      capturedOnProgress = onProgress;
    };

    const timeoutSpy = mock((callback: TimerHandler) => {
      (callback as () => void)();
      return 1 as unknown as Timer;
    });
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;
    globalThis.setTimeout = timeoutSpy as unknown as typeof globalThis.setTimeout;
    globalThis.clearTimeout = (() => undefined) as unknown as typeof clearTimeout;

    try {
      const { AssetDrilldownSection } = await import("@/components/detail/AssetDrilldownSection");
      const harness = createHookHarness(AssetDrilldownSection, {
        code: "ABC",
        ticker: "ABC",
        cusip: "12345678",
        hasCusip: true,
        children: React.createElement("div", null, "child content"),
      });

      harness.settle();
      harness.settle();
      expect(backgroundLoadCalls).toEqual([
        { code: "ABC", cusip: "12345678", excluded: [] },
      ]);
      expect(capturedOnProgress).not.toBeNull();

      harness.unmount();
      const progressCallback: (loaded: number, total: number) => void =
        capturedOnProgress ?? (() => undefined);
      progressCallback(1, 3);

      expect(harness.getStateUpdatesAfterUnmount()).toEqual([]);
    } finally {
      globalThis.setTimeout = originalSetTimeout;
      globalThis.clearTimeout = originalClearTimeout;
    }
  });

  test("asset detail page resets readiness when the route params change", async () => {
    const source = await Bun.file(new URL("./AssetDetail.tsx", import.meta.url)).text();

    expect(source).toContain("readyCalledRef.current = false;");
    expect(source).toContain("}, [code, currentCusip]);");
    expect(source).toContain("const isCurrentRecord = code !== undefined && recordState.code === code && recordState.cusip === currentCusip;");
    expect(source).toContain("if (isCurrentRecord && recordState.record !== undefined) {");
  });

  test("asset detail page keeps the investor flow section independent from inline drilldown expansions", async () => {
    const source = await Bun.file(new URL("./AssetDetail.tsx", import.meta.url)).text();

    expect(source).not.toContain("const [selectedInvestor, setSelectedInvestor]");
    expect(source).not.toContain("onSelectedInvestorChange={setSelectedInvestor}");
    expect(source).toContain("<AssetFlowSection");
    expect(source).not.toContain("selectedInvestor={selectedInvestor}");
  });

  test("asset flow section always renders the investor flow chart below the inline drilldown", async () => {
    const source = await Bun.file(new URL("../components/detail/AssetFlowSection.tsx", import.meta.url)).text();

    expect(source).not.toContain("SuperinvestorAssetHistorySection");
    expect(source).not.toContain("if (selectedInvestor && cusip)");
    expect(source).toContain("<InvestorFlowChart");
  });

  beforeEach(() => {
    mock.restore();
    registerModuleMocks();
    currentActivityRows = [];
    currentFlowRows = [];
    eagerLoadCalls.length = 0;
    backgroundLoadCalls.length = 0;
    cleanupCalls.length = 0;
    currentFetchAssetActivityData = async () => ({ rows: [], queryTimeMs: 0, source: "memory" });
    currentFetchInvestorFlowData = async () => ({ rows: [], queryTimeMs: 0, source: "memory" });
    currentFetchDrilldownBothActions = async () => undefined;
    currentBackgroundLoadAllDrilldownData = async () => undefined;
  });

  test("auto-selects the latest actionable quarter and preloads drilldown data for valid CUSIPs", async () => {
    currentActivityRows = [
      { ticker: "ABC", cusip: "12345678", quarter: "2024-Q3", numOpen: 0, numClose: 2 },
      { ticker: "ABC", cusip: "12345678", quarter: "2024-Q4", numOpen: 4, numClose: 0 },
      { ticker: "ABC", cusip: "OTHER", quarter: "2024-Q4", numOpen: 9, numClose: 0 },
    ];

    currentFetchDrilldownBothActions = async () => undefined;
    currentBackgroundLoadAllDrilldownData = async (_code, _cusip, _excluded, onProgress) => {
      onProgress(1, 1);
    };

    const timeoutSpy = mock((callback: TimerHandler) => {
      (callback as () => void)();
      return 1 as unknown as Timer;
    });
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;
    globalThis.setTimeout = timeoutSpy as unknown as typeof globalThis.setTimeout;
    globalThis.clearTimeout = (() => undefined) as unknown as typeof clearTimeout;

    try {
      const { AssetDrilldownSection } = await import("@/components/detail/AssetDrilldownSection");
      const harness = createHookHarness(AssetDrilldownSection, {
        code: "ABC",
        ticker: "ABC",
        cusip: "12345678",
        hasCusip: true,
        children: React.createElement("div", null, "child content"),
      });

      const tree = harness.settle();
      const drilldownPanels = getDrilldownDetailsPanels(tree);

      expect(eagerLoadCalls).toEqual([
        { code: "ABC", cusip: "12345678", quarter: "2024-Q4" },
      ]);
      expect(backgroundLoadCalls).toEqual([
        { code: "ABC", cusip: "12345678", excluded: [] },
      ]);
      expect(drilldownPanels).toHaveLength(1);
      expect(drilldownPanels[0]?.props).toMatchObject({
        ticker: "ABC",
        cusip: "12345678",
        hasCusip: true,
        resolvedSelection: {
          quarter: "2024-Q4",
          action: "open",
        },
      });
    } finally {
      globalThis.setTimeout = originalSetTimeout;
      globalThis.clearTimeout = originalClearTimeout;
    }
  });

  test("treats underscore CUSIPs as invalid and skips auto-selection, preload, and drilldown table rendering", async () => {
    currentActivityRows = [
      { ticker: "ABC", cusip: null, quarter: "2024-Q3", numOpen: 0, numClose: 2 },
      { ticker: "ABC", cusip: null, quarter: "2024-Q4", numOpen: 4, numClose: 0 },
    ];

    currentFetchDrilldownBothActions = async () => undefined;
    currentBackgroundLoadAllDrilldownData = async (_code, _cusip, _excluded, onProgress) => {
      onProgress(1, 1);
    };

    const timeoutSpy = mock((callback: TimerHandler) => {
      (callback as () => void)();
      return 1 as unknown as Timer;
    });
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;
    globalThis.setTimeout = timeoutSpy as unknown as typeof globalThis.setTimeout;
    globalThis.clearTimeout = (() => undefined) as unknown as typeof globalThis.clearTimeout;

    try {
      const { AssetDrilldownSection } = await import("@/components/detail/AssetDrilldownSection");
      const harness = createHookHarness(AssetDrilldownSection, {
        code: "ABC",
        ticker: "ABC",
        cusip: "_",
        hasCusip: false,
        children: React.createElement("div", null, "child content"),
      });

      const tree = harness.settle();
      const drilldownPanels = getDrilldownDetailsPanels(tree);

      expect(eagerLoadCalls).toEqual([]);
      expect(backgroundLoadCalls).toEqual([]);
      expect(drilldownPanels).toHaveLength(1);
      expect(drilldownPanels[0]?.props).toMatchObject({
        ticker: "ABC",
        cusip: "_",
        hasCusip: false,
        resolvedSelection: null,
      });
    } finally {
      globalThis.setTimeout = originalSetTimeout;
      globalThis.clearTimeout = originalClearTimeout;
    }
  });

  test("keeps activity chart props stable across no-op rerenders after load", async () => {
    currentActivityRows = [
      { ticker: "ABC", cusip: "12345678", quarter: "2024-Q4", numOpen: 4, numClose: 0 },
    ];
    currentFetchAssetActivityData = async () => ({
      rows: [],
      queryTimeMs: 12,
      source: "api",
    });

    const stableSetSelection = () => undefined;

    mock.module("@/components/detail/AssetDrilldownSection", () => ({
      useAssetDrilldownSection: () => ({
        setSelection: stableSetSelection,
      }),
    }));

    const echartsChartMock = (props: any) => React.createElement("div", props, "echarts-chart");

    mock.module("@/components/charts/InvestorActivityEchartsChart", () => ({
      InvestorActivityEchartsChart: echartsChartMock,
    }));

    const { AssetActivitySection } = await import("@/components/detail/AssetActivitySection");
    const harness = createHookHarness(AssetActivitySection, {
      code: "ABC",
      ticker: "ABC",
      cusip: "12345678",
      hasCusip: true,
    });

    harness.settle();
    await Promise.resolve();
    harness.settle();
    await Promise.resolve();
    const loadedTree = harness.settle() as any;
    const rerenderedTree = harness.render() as any;

    const loadedCharts = collectElements(
      loadedTree,
      (node) => typeof node.props?.onRenderComplete === "function" && typeof node.props?.ticker === "string",
    );
    const rerenderedCharts = collectElements(
      rerenderedTree,
      (node) => typeof node.props?.onRenderComplete === "function" && typeof node.props?.ticker === "string",
    );

    expect(loadedCharts).toHaveLength(1);
    expect(rerenderedCharts).toHaveLength(1);

    const [loadedChart] = loadedCharts;
    const [rerenderedChart] = rerenderedCharts;

    expect(rerenderedChart.props.onBarClick).toBe(loadedChart.props.onBarClick);
    expect(rerenderedChart.props.onRenderComplete).toBe(loadedChart.props.onRenderComplete);
    expect(rerenderedChart.props.latencyBadge).toBe(loadedChart.props.latencyBadge);
  });

  test("stretches the asset detail grid so the activity chart and drilldown cards can share the same height", async () => {
    const drilldownSource = await Bun.file(new URL("../components/detail/AssetDrilldownSection.tsx", import.meta.url)).text();
    const activityChartSource = await Bun.file(new URL("../components/charts/InvestorActivityEchartsChart.tsx", import.meta.url)).text();

    expect(drilldownSource).toContain("items-stretch");
    expect(drilldownSource).toContain('className="min-w-0 h-full [&>*]:h-full"');
    expect(activityChartSource).toContain("cardClassName={ASSET_DETAIL_CARD_CLASS_NAME}");
    expect(activityChartSource).toContain("cardContentClassName={ASSET_DETAIL_CARD_CONTENT_CLASS_NAME}");
  });

  test("does not key the drilldown table by selected bar because that remounts the card and search chrome", async () => {
    const drilldownSource = await Bun.file(new URL("../components/detail/AssetDrilldownSection.tsx", import.meta.url)).text();

    expect(drilldownSource).toContain("<InvestorActivityDrilldownTable");
    expect(drilldownSource).not.toContain("key={`click-${ticker}-${cusip}-${resolvedSelection.quarter}-${resolvedSelection.action}`}");
  });

  test("uses equal-width columns for the activity chart and drilldown table on wide screens", async () => {
    const drilldownSource = await Bun.file(new URL("../components/detail/AssetDrilldownSection.tsx", import.meta.url)).text();

    expect(drilldownSource).toContain('xl:grid-cols-2');
    expect(drilldownSource).not.toContain('xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]');
  });

  test("keeps full-width asset detail pages inside responsive gutters while using a wider max width", async () => {
    const pageSource = await Bun.file(new URL("./AssetDetail.tsx", import.meta.url)).text();
    const layoutSource = await Bun.file(new URL("../components/layout/page-layout.tsx", import.meta.url)).text();
    const cssSource = await Bun.file(new URL("../index.css", import.meta.url)).text();

    expect(pageSource).toContain('<PageLayout width="full" className="space-y-8">');
    expect(layoutSource).toContain('max-w-[var(--page-max-width)]');
    expect(layoutSource).toContain('px-[var(--page-gutter)] py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10');
    expect(cssSource).toContain('--page-max-width: 100vw;');
    expect(cssSource).toContain('--page-max-width-wide: 100vw;');
  });
});
