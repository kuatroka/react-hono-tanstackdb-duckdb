import React from "react";
import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import * as collectionsModule from "@/collections";
import * as pageCacheCleanupModule from "@/collections/page-cache-cleanup";

interface SuperinvestorRecord {
  cik: string;
  cikName: string;
}

interface CikQuarterlyRow {
  cik: string;
  quarter: string;
  totalValue: number;
}

interface HookHarness {
  render: () => unknown;
  flushEffects: () => void;
  settle: () => unknown;
  unmount: () => void;
  updateProps: (nextProps: any) => void;
}

const onReadyCalls: string[] = [];
const fetchSuperinvestorRecordCalls: string[] = [];
const fetchCikQuarterlyDataCalls: string[] = [];
const cleanupCalls: string[] = [];
let params: { cik?: string } = {};
let currentOnReady: () => void = () => undefined;
let currentFetchSuperinvestorRecord: (cik: string) => Promise<SuperinvestorRecord | null> = async () => null;
let currentFetchCikQuarterlyData: (cik: string) => Promise<{ queryTimeMs: number; source: string }> = async () => ({
  queryTimeMs: 0,
  source: "memory",
});
let currentLiveQueryRows: CikQuarterlyRow[] = [];

function registerModuleMocks() {
  mock.module("@tanstack/react-router", () => ({
    Link: (props: any) => React.createElement("a", props, props.children),
    useParams: () => params,
    useNavigate: () => () => undefined,
    useSearch: () => ({}),
  }));

  mock.module("@tanstack/react-db", () => ({}));

  mock.module("@/hooks/useContentReady", () => ({
    useContentReady: () => ({
      onReady: () => {
        onReadyCalls.push("ready");
        currentOnReady();
      },
    }),
  }));

  spyOn(collectionsModule, "fetchSuperinvestorRecord").mockImplementation((cik: string) => {
    fetchSuperinvestorRecordCalls.push(cik);
    return currentFetchSuperinvestorRecord(cik);
  });

  spyOn(collectionsModule, "fetchCikQuarterlyData").mockImplementation((cik: string) => {
    fetchCikQuarterlyDataCalls.push(cik);
    return currentFetchCikQuarterlyData(cik) as any;
  });

  spyOn(collectionsModule, "hasFetchedCikData").mockImplementation(
    (cik: string) => currentLiveQueryRows.some((row) => row.cik === cik)
  );

  spyOn(collectionsModule, "getCikQuarterlyDataFromCache").mockImplementation((cik: string) => {
    const rows = currentLiveQueryRows
      .filter((row) => row.cik === cik)
      .sort((left, right) => left.quarter.localeCompare(right.quarter));
    return rows.length > 0 ? rows : null;
  });

  spyOn(pageCacheCleanupModule, "clearSuperinvestorDetailRouteCaches").mockImplementation(() => {
    cleanupCalls.push("cleared");
  });

  mock.module("@/components/charts/CikValueLineChart", () => ({
    CikValueLineChart: (props: any) => React.createElement("div", props, "chart"),
  }));
}

function depsChanged(prev: unknown[] | undefined, next: unknown[] | undefined) {
  if (!prev || !next) return true;
  if (prev.length !== next.length) return true;
  return next.some((value, index) => !Object.is(value, prev[index]));
}

function createHookHarness(component: (props: any) => unknown, initialProps: any): HookHarness {
  const hookState: unknown[] = [];
  const hookDeps: Array<unknown[] | undefined> = [];
  const hookCleanups: Array<(() => void) | undefined> = [];
  let hookIndex = 0;
  let pendingEffects: Array<() => void> = [];
  let scheduledUpdate = false;
  let latestTree: unknown;
  let mounted = true;
  let props = initialProps;

  const actualReact = React;

  mock.module("react", () => ({
    ...actualReact,
    useState<T>(initial: T | (() => T)) {
      const stateIndex = hookIndex++;
      if (!(stateIndex in hookState)) {
        hookState[stateIndex] = typeof initial === "function" ? (initial as () => T)() : initial;
      }
      const setState = (next: T | ((current: T) => T)) => {
        const current = hookState[stateIndex] as T;
        const resolved = typeof next === "function" ? (next as (current: T) => T)(current) : next;
        if (!mounted) {
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
    useMemo<T>(factory: () => T) {
      hookIndex++;
      return factory();
    },
    useCallback<T extends (...args: any[]) => any>(callback: T) {
      hookIndex++;
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

  const updateProps = (nextProps: any) => {
    props = nextProps;
  };

  return { render, flushEffects, settle, unmount, updateProps };
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

describe("superinvestor detail route split", () => {
  beforeEach(() => {
    mock.restore();
    registerModuleMocks();
    onReadyCalls.length = 0;
    fetchSuperinvestorRecordCalls.length = 0;
    fetchCikQuarterlyDataCalls.length = 0;
    cleanupCalls.length = 0;
    params = {};
    currentOnReady = () => undefined;
    currentFetchSuperinvestorRecord = async () => null;
    currentFetchCikQuarterlyData = async () => ({ queryTimeMs: 0, source: "memory" });
    currentLiveQueryRows = [];
  });

  test("calls onReady again when navigating to another superinvestor on the same route", async () => {
    currentFetchSuperinvestorRecord = async (cik: string) => ({ cik, cikName: `Fund ${cik}` });
    params = { cik: "1001" };

    const { SuperinvestorDetailPage } = await import("@/pages/SuperinvestorDetail");
    const harness = createHookHarness(SuperinvestorDetailPage, {});

    harness.settle();
    await Promise.resolve();
    harness.settle();

    expect(fetchSuperinvestorRecordCalls).toEqual(["1001"]);
    expect(onReadyCalls).toHaveLength(1);

    params.cik = "2002";

    harness.settle();
    await Promise.resolve();
    harness.settle();

    expect(fetchSuperinvestorRecordCalls).toEqual(["1001", "2002"]);
    expect(onReadyCalls).toHaveLength(2);
  });

  test("chart section initializes from the active cik cache slice only", async () => {
    currentLiveQueryRows = [
      { cik: "1001", quarter: "2024-Q4", totalValue: 200 },
      { cik: "2002", quarter: "2024-Q3", totalValue: 300 },
    ];
    currentFetchCikQuarterlyData = async () => ({ queryTimeMs: 0, source: "memory" });

    const { SuperinvestorChartSection } = await import("@/components/detail/SuperinvestorChartSection");
    const tree = createHookHarness(SuperinvestorChartSection, { cik: "1001", cikName: "Fund 1001" }).settle() as any;

    expect(tree.props?.data).toEqual([{ cik: "1001", quarter: "2024-Q4", totalValue: 200 }]);
  });

  test("chart section shows loading UI on first paint for a new cik", async () => {
    currentLiveQueryRows = [];
    let resolveFetch: ((value: { queryTimeMs: number; source: string }) => void) | null = null;
    currentFetchCikQuarterlyData =
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        });

    const { SuperinvestorChartSection } = await import("@/components/detail/SuperinvestorChartSection");
    const harness = createHookHarness(SuperinvestorChartSection, { cik: "1001", cikName: "Fund 1001" });

    const firstTree = harness.render();
    const loadingNodes = collectElements(
      firstTree,
      (node) => typeof node.props?.children === "string" && node.props.children.includes("Loading portfolio history")
    );
    const chartNodes = collectElements(firstTree, (node) => node.type === "div" && node.props?.children === "chart");

    expect(loadingNodes).toHaveLength(1);
    expect(chartNodes).toHaveLength(0);

    harness.flushEffects();
    resolveFetch?.({ queryTimeMs: 14, source: "api" });
    await Promise.resolve();
    harness.settle();
  });

  test("chart section passes narrow timing props to the chart and owns cache cleanup", async () => {
    currentLiveQueryRows = [
      { cik: "1001", quarter: "2024-Q4", totalValue: 200 },
      { cik: "2002", quarter: "2024-Q3", totalValue: 300 },
    ];
    currentFetchCikQuarterlyData = async () => ({ queryTimeMs: 14, source: "api" });

    const { SuperinvestorChartSection } = await import("@/components/detail/SuperinvestorChartSection");
    const harness = createHookHarness(SuperinvestorChartSection, { cik: "1001", cikName: "Fund 1001" });

    harness.settle();
    await Promise.resolve();
    const tree = harness.settle() as any;

    expect(tree.props).toMatchObject({
      cikName: "Fund 1001",
      dataLoadMs: 14,
      source: "tsdb-api",
    });
    expect(tree.props).not.toHaveProperty("latencyBadge");

    harness.updateProps({ cik: "2002", cikName: "Fund 2002" });
    harness.settle();
    await Promise.resolve();
    harness.settle();

    harness.unmount();

    expect(fetchCikQuarterlyDataCalls).toEqual(["1001", "2002"]);
    expect(cleanupCalls).toEqual(["cleared", "cleared"]);
  });
});
