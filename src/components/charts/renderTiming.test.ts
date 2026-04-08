import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createDeferredRenderCompletion } from "./renderTiming";

describe("createDeferredRenderCompletion", () => {
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
  let currentNow = 0;
  let nextFrameId = 1;
  let frameQueue = new Map<number, FrameRequestCallback>();

  const flushAnimationFrame = (timestamp = 16) => {
    const callbacks = [...frameQueue.values()];
    frameQueue = new Map();
    for (const callback of callbacks) {
      callback(timestamp);
    }
  };

  beforeEach(() => {
    currentNow = 0;
    nextFrameId = 1;
    frameQueue = new Map();

    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      const frameId = nextFrameId++;
      frameQueue.set(frameId, callback);
      return frameId;
    }) as typeof requestAnimationFrame;

    globalThis.cancelAnimationFrame = ((frameId: number) => {
      frameQueue.delete(frameId);
    }) as typeof cancelAnimationFrame;

    spyOn(performance, "now").mockImplementation(() => currentNow);
  });

  afterEach(() => {
    mock.restore();
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  test("defers completion to the next animation frame and deduplicates repeated signals", () => {
    currentNow = 100;
    const renderStartRef = { current: 100 };
    const onRenderComplete = mock();
    const completion = createDeferredRenderCompletion({ renderStartRef, onRenderComplete });

    currentNow = 103;
    completion.schedule();
    completion.schedule();

    expect(onRenderComplete).not.toHaveBeenCalled();
    expect(frameQueue.size).toBe(1);

    currentNow = 118;
    flushAnimationFrame();

    expect(onRenderComplete).toHaveBeenCalledTimes(1);
    expect(onRenderComplete).toHaveBeenCalledWith(18);
    expect(renderStartRef.current).toBeNull();

    currentNow = 130;
    completion.schedule();
    expect(onRenderComplete).toHaveBeenCalledTimes(1);
  });

  test("cancels pending completion work during cleanup", () => {
    currentNow = 200;
    const renderStartRef = { current: 200 };
    const onRenderComplete = mock();
    const completion = createDeferredRenderCompletion({ renderStartRef, onRenderComplete });

    currentNow = 204;
    completion.schedule();
    completion.cancel();

    currentNow = 220;
    flushAnimationFrame();

    expect(onRenderComplete).not.toHaveBeenCalled();
    expect(renderStartRef.current).toBe(200);
  });
});

describe("ECharts latency timing contract", () => {
  const readChartFile = (name: string) =>
    readFileSync(join(import.meta.dir, name), "utf8");

  test("uses the shared deferred completion helper instead of synchronous post-setOption completion", () => {
    const openedClosedBarChart = readChartFile("OpenedClosedBarChart.tsx");
    const investorFlowChart = readChartFile("InvestorFlowChart.tsx");
    const cikValueEchartsChart = readChartFile("CikValueEchartsChart.tsx");

    expect(openedClosedBarChart).toContain("createDeferredRenderCompletion");
    expect(openedClosedBarChart).toContain("renderCompletion.schedule()");
    expect(openedClosedBarChart).not.toContain("const elapsed = Math.round(performance.now() - renderStartRef.current)");

    expect(investorFlowChart).toContain("createDeferredRenderCompletion");
    expect(investorFlowChart).toContain("renderCompletion.schedule()");
    expect(investorFlowChart).not.toContain("const elapsed = Math.round(performance.now() - renderStartRef.current)");

    expect(cikValueEchartsChart).toContain("createDeferredRenderCompletion");
    expect(cikValueEchartsChart).toContain("renderCompletion.schedule()");
    expect(cikValueEchartsChart).not.toContain("const elapsed = Math.round(performance.now() - renderStartRef.current)");
  });
});
