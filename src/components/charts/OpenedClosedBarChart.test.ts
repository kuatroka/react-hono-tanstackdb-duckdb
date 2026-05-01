import React from "react";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

interface HookHarness {
  render: () => unknown;
  flushEffects: () => void;
  unmount: () => void;
}

interface CapturedChartInstance {
  handlers: Record<string, Array<(params?: unknown) => void>>;
  zrHandlers: Record<string, Array<(params?: unknown) => void>>;
  containPixelResult: boolean;
  pixelToValue: [number, number];
}

interface ChartHarnessProps {
  data: Array<{ quarter: string; opened: number; closed: number }>;
  title: string;
  onBarClick?: (selection: { quarter: string; action: "open" | "close" }) => void;
}

type HarnessComponent<TProps> =
  | ((props: TProps) => unknown)
  | { type: (props: TProps) => unknown };

const fakeContainer = {
  clientWidth: 640,
  clientHeight: 360,
  style: {
    cursor: "default",
  },
};

let chartInstance: CapturedChartInstance | null = null;

function depsChanged(prev: unknown[] | undefined, next: unknown[] | undefined) {
  if (!prev || !next) return true;
  if (prev.length !== next.length) return true;
  return next.some((value, index) => !Object.is(value, prev[index]));
}

function createHookHarness<TProps>(component: HarnessComponent<TProps>, props: TProps): HookHarness {
  const hookState: unknown[] = [];
  const hookDeps: Array<unknown[] | undefined> = [];
  const hookCleanups: Array<(() => void) | undefined> = [];
  let hookIndex = 0;
  let pendingEffects: Array<() => void> = [];

  const actualReact = React;

  mock.module("react", () => ({
    ...actualReact,
    memo: (value: unknown) => value,
    useRef<T>(initial: T) {
      const refIndex = hookIndex++;
      if (!(refIndex in hookState)) {
        hookState[refIndex] = { current: refIndex === 0 ? fakeContainer : initial };
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
    useEffect(effect: () => void | (() => void), deps?: unknown[]) {
      const effectIndex = hookIndex++;
      const previousDeps = hookDeps[effectIndex];
      if (!depsChanged(previousDeps, deps)) {
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
    const resolvedComponent = typeof component === "function"
      ? component
      : component.type;

    return resolvedComponent(props);
  };

  const flushEffects = () => {
    const queued = pendingEffects;
    pendingEffects = [];
    queued.forEach((run) => run());
  };

  const unmount = () => {
    for (const cleanup of hookCleanups) {
      cleanup?.();
    }
  };

  return { render, flushEffects, unmount };
}

function registerModuleMocks() {
  chartInstance = {
    handlers: {},
    zrHandlers: {},
    containPixelResult: true,
    pixelToValue: [0, 0],
  };

  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
    unobserve() {}
  } as unknown as typeof ResizeObserver;

  mock.module("@/components/ui/card", () => ({
    Card: ({ children }: { children?: React.ReactNode }) => React.createElement("section", null, children),
    CardContent: ({ children }: { children?: React.ReactNode }) => React.createElement("div", null, children),
    CardHeader: ({ children }: { children?: React.ReactNode }) => React.createElement("header", null, children),
    CardTitle: ({ children }: { children?: React.ReactNode }) => React.createElement("h2", null, children),
  }));

  mock.module("@/lib/utils", () => ({
    cn: (...values: Array<string | undefined | false | null>) => values.filter(Boolean).join(" "),
  }));

  mock.module("echarts/core", () => ({
    use: () => undefined,
    getInstanceByDom: () => null,
    init: () => ({
      on: (eventName: string, handler: (params?: unknown) => void) => {
        chartInstance?.handlers[eventName]?.push(handler);
        if (!chartInstance?.handlers[eventName]) {
          chartInstance!.handlers[eventName] = [handler];
        }
      },
      off: (eventName: string, handler: (params?: unknown) => void) => {
        chartInstance!.handlers[eventName] = (chartInstance?.handlers[eventName] ?? []).filter((value) => value !== handler);
      },
      getZr: () => ({
        on: (eventName: string, handler: (params?: unknown) => void) => {
          chartInstance?.zrHandlers[eventName]?.push(handler);
          if (!chartInstance?.zrHandlers[eventName]) {
            chartInstance!.zrHandlers[eventName] = [handler];
          }
        },
        off: (eventName: string, handler: (params?: unknown) => void) => {
          chartInstance!.zrHandlers[eventName] = (chartInstance?.zrHandlers[eventName] ?? []).filter((value) => value !== handler);
        },
      }),
      getDom: () => ({ style: { cursor: "default" } }),
      containPixel: () => chartInstance?.containPixelResult ?? false,
      convertFromPixel: () => chartInstance?.pixelToValue ?? [NaN, NaN],
      resize: () => undefined,
      setOption: () => undefined,
      isDisposed: () => false,
      dispose: () => undefined,
    }),
  }));

  mock.module("echarts/charts", () => ({ BarChart: {} }));
  mock.module("echarts/components", () => ({
    GridComponent: {},
    TooltipComponent: {},
    MarkLineComponent: {},
  }));
  mock.module("echarts/features", () => ({ LegacyGridContainLabel: {} }));
  mock.module("echarts/renderers", () => ({ CanvasRenderer: {} }));
}

describe("OpenedClosedBarChart", () => {
  beforeEach(() => {
    mock.restore();
    registerModuleMocks();
  });

  afterEach(() => {
    mock.restore();
  });

  test("dispatches bar clicks even when ECharts omits componentType for series payloads", async () => {
    const clicks: Array<{ quarter: string; action: "open" | "close" }> = [];
    const { OpenedClosedBarChart } = await import("./OpenedClosedBarChart");
    const harness = createHookHarness(OpenedClosedBarChart as unknown as (props: ChartHarnessProps) => unknown, {
      data: [{ quarter: "2015Q3", opened: 0, closed: 1 }],
      title: "Investor Activity",
      onBarClick: (selection: { quarter: string; action: "open" | "close" }) => {
        clicks.push(selection);
      },
    });

    harness.render();
    harness.flushEffects();

    const clickHandler = chartInstance?.handlers.click?.[0];
    expect(clickHandler).toBeDefined();

    clickHandler?.({ name: "2015Q3", seriesName: "Closed" });

    expect(clicks).toEqual([{ quarter: "2015Q3", action: "close" }]);

    harness.unmount();
  });

  test("falls back to canvas pixel mapping when axis interactions do not emit a series click payload", async () => {
    const clicks: Array<{ quarter: string; action: "open" | "close" }> = [];
    if (chartInstance) {
      chartInstance.pixelToValue = [0, -0.5];
    }
    const { OpenedClosedBarChart } = await import("./OpenedClosedBarChart");
    const harness = createHookHarness(OpenedClosedBarChart as unknown as (props: ChartHarnessProps) => unknown, {
      data: [{ quarter: "2015Q3", opened: 0, closed: 1 }],
      title: "Investor Activity",
      onBarClick: (selection: { quarter: string; action: "open" | "close" }) => {
        clicks.push(selection);
      },
    });

    harness.render();
    harness.flushEffects();

    const zrClickHandler = chartInstance?.zrHandlers.click?.[0];
    expect(zrClickHandler).toBeDefined();

    zrClickHandler?.({ offsetX: 100, offsetY: 200 });

    expect(clicks).toEqual([{ quarter: "2015Q3", action: "close" }]);

    harness.unmount();
  });

  test("shows a pointer cursor when bar clicks are enabled", async () => {
    const source = await Bun.file(new URL("./OpenedClosedBarChart.tsx", import.meta.url)).text();

    expect(source).toContain('cursor: onBarClick ? "pointer" : "default"');
    expect(source).toContain('const resolvedCursor = onBarClick ? "pointer" : "default"');
    expect(source).toContain('container.style.cursor = resolvedCursor');
    expect(source).toContain('chart.getDom().style.cursor = resolvedCursor');
  });

  test("ignores explicit non-series click events", async () => {
    const clicks: Array<{ quarter: string; action: "open" | "close" }> = [];
    const { OpenedClosedBarChart } = await import("./OpenedClosedBarChart");
    const harness = createHookHarness(OpenedClosedBarChart as unknown as (props: ChartHarnessProps) => unknown, {
      data: [{ quarter: "2015Q3", opened: 0, closed: 1 }],
      title: "Investor Activity",
      onBarClick: (selection: { quarter: string; action: "open" | "close" }) => {
        clicks.push(selection);
      },
    });

    harness.render();
    harness.flushEffects();

    const clickHandler = chartInstance?.handlers.click?.[0];
    expect(clickHandler).toBeDefined();

    clickHandler?.({ componentType: "xAxis", name: "2015Q3", seriesName: "Closed" });

    expect(clicks).toEqual([]);

    harness.unmount();
  });
});
