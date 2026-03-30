import React from "react";
import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import * as collectionsModule from "@/collections";
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

const onReadyCalls: string[] = [];
const fetchAssetRecordCalls: Array<{ code: string; cusip: string | null | undefined }> = [];
let params: { code?: string; cusip?: string } = {};
let currentOnReady: () => void = () => undefined;
let currentFetchAssetRecord: (code: string, cusip?: string | null) => Promise<any> = async () => null;
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

  mock.module("@tanstack/react-router", () => ({
    Link: (props: any) => React.createElement("a", props, props.children),
    useParams: () => params,
    useNavigate: () => () => undefined,
    useSearch: () => ({}),
  }));

  spyOn(collectionsModule, "fetchAssetRecord").mockImplementation((code: string, cusip?: string | null) => {
    fetchAssetRecordCalls.push({ code, cusip });
    return currentFetchAssetRecord(code, cusip);
  });

  spyOn(collectionsModule, "fetchAssetActivityData").mockImplementation(
    ((code: string, cusip?: string | null) => currentFetchAssetActivityData(code, cusip)) as any,
  );

  spyOn(collectionsModule, "fetchInvestorFlowData").mockImplementation(
    ((code: string) => currentFetchInvestorFlowData(code)) as any,
  );

  mock.module("@/components/InvestorActivityDrilldownTable", () => ({
    InvestorActivityDrilldownTable: (props: {
      ticker: string;
      cusip: string;
      quarter: string;
      action: InvestorActivityAction;
    }) => React.createElement("div", props),
  }));

  mock.module("@/collections/investor-details", () => ({
    fetchDrilldownBothActions: (code: string, cusip: string, quarter: string) => {
      eagerLoadCalls.push({ code, cusip, quarter });
      return currentFetchDrilldownBothActions(code, cusip, quarter);
    },
    backgroundLoadAllDrilldownData: (
      code: string,
      cusip: string,
      excluded: string[],
      onProgress: (loaded: number, total: number) => void,
    ) => {
      backgroundLoadCalls.push({ code, cusip, excluded });
      return currentBackgroundLoadAllDrilldownData(code, cusip, excluded, onProgress);
    },
  }));

  spyOn(pageCacheCleanupModule, "clearAssetDetailRouteCaches").mockImplementation(() => {
    cleanupCalls.push("cleared");
  });

  mock.module("@/hooks/useContentReady", () => ({
    useContentReady: () => ({
      onReady: () => {
        onReadyCalls.push("ready");
        currentOnReady();
      },
    }),
  }));

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

function getInteractionPanelElements(tree: unknown) {
  return collectElements(
    tree,
    (node) => typeof node.type === "function" && node.props?.hoverSelectionStore && "resolvedSelection" in node.props,
  );
}

describe("asset detail section runtime behavior", () => {
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

  test("calls onReady again when navigating to another asset on the same route", async () => {
    currentOnReady = () => undefined;
    currentFetchAssetRecord = async (code: string, cusip?: string | null) => ({
      asset: code,
      assetName: `Asset ${code}`,
      cusip,
    });
    params = { code: "AAA", cusip: "111" };

    const { AssetDetailPage } = await import("@/pages/AssetDetail");
    const harness = createHookHarness(AssetDetailPage, {});

    harness.settle();
    await Promise.resolve();
    await Promise.resolve();
    harness.settle();

    expect(onReadyCalls).toHaveLength(1);
    expect(fetchAssetRecordCalls[0]).toEqual({ code: "AAA", cusip: "111" });

    params.code = "BBB";
    params.cusip = "222";

    harness.settle();
    await Promise.resolve();
    await Promise.resolve();
    harness.settle();

    expect(fetchAssetRecordCalls[1]).toEqual({ code: "BBB", cusip: "222" });
    expect(onReadyCalls).toHaveLength(2);
  });

  beforeEach(() => {
    mock.restore();
    registerModuleMocks();
    currentActivityRows = [];
    currentFlowRows = [];
    eagerLoadCalls.length = 0;
    backgroundLoadCalls.length = 0;
    cleanupCalls.length = 0;
    onReadyCalls.length = 0;
    fetchAssetRecordCalls.length = 0;
    params = {};
    currentOnReady = () => undefined;
    currentFetchAssetRecord = async () => null;
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
      const interactionPanels = getInteractionPanelElements(tree);

      expect(eagerLoadCalls).toEqual([
        { code: "ABC", cusip: "12345678", quarter: "2024-Q4" },
      ]);
      expect(backgroundLoadCalls).toEqual([
        { code: "ABC", cusip: "12345678", excluded: [] },
      ]);
      expect(interactionPanels).toHaveLength(1);
      expect(interactionPanels[0]?.props).toMatchObject({
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
      const interactionPanels = getInteractionPanelElements(tree);

      expect(eagerLoadCalls).toEqual([]);
      expect(backgroundLoadCalls).toEqual([]);
      expect(interactionPanels).toHaveLength(1);
      expect(interactionPanels[0]?.props).toMatchObject({
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
    const stableSetHoverSelection = () => undefined;

    mock.module("@/components/detail/AssetDrilldownSection", () => ({
      useAssetDrilldownSection: () => ({
        setSelection: stableSetSelection,
        setHoverSelection: stableSetHoverSelection,
      }),
    }));

    const uplotChartMock = (props: any) => React.createElement("div", props, "uplot-chart");
    const echartsChartMock = (props: any) => React.createElement("div", props, "echarts-chart");

    mock.module("@/components/charts/InvestorActivityUplotChart", () => ({
      InvestorActivityUplotChart: uplotChartMock,
    }));

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

    expect(loadedCharts).toHaveLength(2);
    expect(rerenderedCharts).toHaveLength(2);

    const [loadedUplot, loadedEcharts] = loadedCharts;
    const [rerenderedUplot, rerenderedEcharts] = rerenderedCharts;

    expect(rerenderedUplot.props.onBarClick).toBe(loadedUplot.props.onBarClick);
    expect(rerenderedUplot.props.onBarHover).toBe(loadedUplot.props.onBarHover);
    expect(rerenderedUplot.props.onBarLeave).toBe(loadedUplot.props.onBarLeave);
    expect(rerenderedUplot.props.latencyBadge).toBe(loadedUplot.props.latencyBadge);
    expect(rerenderedEcharts.props.onBarClick).toBe(loadedEcharts.props.onBarClick);
    expect(rerenderedEcharts.props.onBarHover).toBe(loadedEcharts.props.onBarHover);
    expect(rerenderedEcharts.props.onBarLeave).toBe(loadedEcharts.props.onBarLeave);
    expect(rerenderedEcharts.props.latencyBadge).toBe(loadedEcharts.props.latencyBadge);
  });
});
