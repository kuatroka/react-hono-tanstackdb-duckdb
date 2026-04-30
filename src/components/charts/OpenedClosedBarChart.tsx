"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  MarkLineComponent,
} from "echarts/components";
import { LegacyGridContainLabel } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { QuarterlyActivityPoint } from "@/types/duckdb";

function cssVar(name: string) {
  if (typeof window === "undefined" || typeof getComputedStyle === "undefined") return "transparent";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "transparent";
}

echarts.use([
  BarChart,
  GridComponent,
  TooltipComponent,
  MarkLineComponent,
  CanvasRenderer,
  LegacyGridContainLabel,
]);

interface OpenedClosedBarChartProps {
  data: readonly QuarterlyActivityPoint[];
  title: string;
  onBarClick?: (selection: { quarter: string; action: "open" | "close" }) => void;
  onBarHover?: (selection: { quarter: string; action: "open" | "close" }) => void;
  onBarLeave?: () => void;
  unitLabel?: string;
  latencyBadge?: React.ReactNode;
  onRenderComplete?: (renderMs: number) => void;
  cardClassName?: string;
  cardContentClassName?: string;
}

interface OpenedClosedChartEvent {
  componentType?: string;
  name?: string;
  seriesName?: string;
  seriesIndex?: number;
  dataIndex?: number;
  value?: number | string | null;
}

interface OpenedClosedChartPoint {
  quarter: string;
  opened: number;
  closed: number;
}

interface OpenedClosedZrEvent {
  offsetX?: number;
  offsetY?: number;
  zrX?: number;
  zrY?: number;
}

function resolveOpenedClosedSelection(
  params: OpenedClosedChartEvent,
  chartData: readonly OpenedClosedChartPoint[],
): { quarter: string; action: "open" | "close" } | null {
  if (params.componentType && params.componentType !== "series") {
    return null;
  }

  const quarter = typeof params.dataIndex === "number"
    ? chartData[params.dataIndex]?.quarter
    : params.name;

  if (!quarter) {
    return null;
  }

  if (params.seriesName === "Opened" || params.seriesIndex === 0) {
    return { quarter, action: "open" };
  }

  if (params.seriesName === "Closed" || params.seriesIndex === 1) {
    return { quarter, action: "close" };
  }

  const numericValue = Number(params.value);
  if (!Number.isNaN(numericValue) && numericValue !== 0) {
    return { quarter, action: numericValue > 0 ? "open" : "close" };
  }

  return null;
}

function resolveOpenedClosedSelectionFromPixel(
  chart: echarts.EChartsType,
  chartData: readonly OpenedClosedChartPoint[],
  point: [number, number],
): { quarter: string; action: "open" | "close" } | null {
  if (!chart.containPixel({ gridIndex: 0 }, point)) {
    return null;
  }

  const converted = chart.convertFromPixel({ xAxisIndex: 0, yAxisIndex: 0 }, point);
  if (!Array.isArray(converted) || converted.length < 2) {
    return null;
  }

  const dataIndex = Math.round(Number(converted[0]));
  const yValue = Number(converted[1]);
  const row = chartData[dataIndex];

  if (!row || Number.isNaN(yValue) || yValue === 0) {
    return null;
  }

  if (yValue > 0 && yValue <= row.opened) {
    return { quarter: row.quarter, action: "open" };
  }

  if (yValue < 0 && Math.abs(yValue) <= Math.abs(row.closed)) {
    return { quarter: row.quarter, action: "close" };
  }

  return null;
}

interface OpenedClosedTooltipParam {
  axisValueLabel?: string;
  seriesName?: string;
  value?: number | string | null;
}

export const OpenedClosedBarChart = memo(function OpenedClosedBarChart({
  data,
  title,
  onBarClick,
  onBarHover,
  onBarLeave,
  unitLabel = "positions",
  latencyBadge,
  onRenderComplete,
  cardClassName,
  cardContentClassName,
}: OpenedClosedBarChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.EChartsType | null>(null);
  const renderStartRef = useRef<number | null>(null);

  const chartData = useMemo(() => {
    return data.map((item) => ({
      quarter: item.quarter ?? "Unknown",
      opened: item.opened ?? 0,
      closed: -(item.closed ?? 0),
    }));
  }, [data]);

  const option = useMemo(() => {
    if (chartData.length === 0) return null;

    const chartBackground = cssVar("--chart-bg");
    const chartGrid = cssVar("--chart-grid");
    const chartAxis = cssVar("--chart-axis");
    const chartZeroLine = cssVar("--chart-zero-line");
    const chartBarPositive = cssVar("--chart-bar-positive");
    const chartBarNegative = cssVar("--chart-bar-negative");

    const quarters = chartData.map((item) => item.quarter);
    const openedValues = chartData.map((item) => item.opened);
    const closedValues = chartData.map((item) => item.closed);
    const maxValue = Math.max(
      1,
      ...chartData.map((item) => Math.max(Math.abs(item.opened), Math.abs(item.closed))),
    );
    const maxDomain = maxValue * 1.1;

    return {
      animation: false,
      backgroundColor: chartBackground,
      textStyle: {
        color: chartAxis,
        fontFamily: "var(--font-sans)",
      },
      grid: {
        top: 48,
        right: 48,
        bottom: 80,
        left: 48,
        containLabel: true,
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: OpenedClosedTooltipParam[]) => {
          const lines = params.map((param) => {
            const label = param.seriesName;
            const value = Math.abs(Number(param.value));
            return `${label}: ${value.toLocaleString()} ${unitLabel}`;
          });
          return [`<strong>${params[0]?.axisValueLabel ?? ""}</strong>`, ...lines].join("<br/>");
        },
      },
      xAxis: {
        type: "category",
        data: quarters,
        boundaryGap: true,
        axisLabel: {
          rotate: 0,
          hideOverlap: true,
          interval: "auto",
          formatter: (value: string) => {
            if (!quarters.includes(value)) return "";
            const match = value.match(/^(\d{4})-Q(\d)$/);
            if (match) {
              const [, year, quarter] = match;
              return `Q${quarter} '${year.slice(-2)}`;
            }
            return value;
          },
        },
        axisTick: { alignWithLabel: true },
        axisLine: {
          lineStyle: { color: chartAxis },
        },
      },
      yAxis: {
        type: "value",
        min: -maxDomain,
        max: maxDomain,
        splitNumber: 6,
        axisLabel: {
          formatter: (value: number) => {
            const absValue = Math.abs(value);
            if (Math.abs(absValue - maxDomain) < maxDomain * 0.05) return "";
            return absValue.toString();
          },
          margin: 8,
        },
        splitLine: {
          lineStyle: {
            type: "dashed",
            color: chartGrid,
          },
        },
        axisLine: {
          lineStyle: { color: chartAxis },
        },
        position: "left",
      },
      series: [
        {
          name: "Opened",
          type: "bar",
          stack: "activity",
          cursor: onBarClick ? "pointer" : "default",
          emphasis: { focus: "series" },
          itemStyle: {
            color: chartBarPositive,
            borderRadius: [4, 4, 0, 0],
          },
          data: openedValues,
          markLine: {
            silent: true,
            symbol: "none",
            label: { show: false },
            lineStyle: {
              color: chartZeroLine,
              width: 1,
              opacity: 1,
            },
            data: [{ yAxis: 0 }],
          },
        },
        {
          name: "Closed",
          type: "bar",
          stack: "activity",
          cursor: onBarClick ? "pointer" : "default",
          emphasis: { focus: "series" },
          itemStyle: {
            color: chartBarNegative,
            borderRadius: [0, 0, 4, 4],
          },
          data: closedValues,
        },
      ],
    };
  }, [chartData, onBarClick, unitLabel]);

  useEffect(() => {
    if (chartData.length === 0) {
      renderStartRef.current = null;
      return;
    }
    renderStartRef.current = performance.now();
  }, [chartData]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !option) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width <= 0 || height <= 0) return;

    const chart =
      echarts.getInstanceByDom(container) ??
      echarts.init(container, undefined, {
        renderer: "canvas",
        width,
        height,
      });

    chartRef.current = chart;

    const handleChartFinished = () => {
      if (renderStartRef.current == null || !onRenderComplete) {
        return;
      }
      const elapsed = Math.round(performance.now() - renderStartRef.current);
      onRenderComplete(elapsed);
      renderStartRef.current = null;
    };

    const clickHandler = (params: OpenedClosedChartEvent) => {
      if (!onBarClick) return;
      const selection = resolveOpenedClosedSelection(params, chartData);
      if (!selection) return;
      onBarClick(selection);
    };

    const zrClickHandler = (event: OpenedClosedZrEvent) => {
      if (!onBarClick) return;
      const x = event.offsetX ?? event.zrX;
      const y = event.offsetY ?? event.zrY;
      if (typeof x !== "number" || typeof y !== "number") {
        return;
      }

      const selection = resolveOpenedClosedSelectionFromPixel(chart, chartData, [x, y]);
      if (!selection) {
        return;
      }

      onBarClick(selection);
    };

    const hoverHandler = (params: OpenedClosedChartEvent) => {
      if (!onBarHover) return;
      const selection = resolveOpenedClosedSelection(params, chartData);
      if (!selection) return;
      onBarHover(selection);
    };

    const mouseOutHandler = () => {
      onBarLeave?.();
    };

    const resolvedCursor = onBarClick ? "pointer" : "default";
    container.style.cursor = resolvedCursor;
    chart.getDom().style.cursor = resolvedCursor;

    chart.on("finished", handleChartFinished);
    chart.on("click", clickHandler);
    chart.getZr().on("click", zrClickHandler);
    chart.on("mouseover", hoverHandler);
    chart.on("globalout", mouseOutHandler);
    chart.resize({ width, height });
    chart.setOption(option, {
      notMerge: false,
      lazyUpdate: false,
    });

    return () => {
      try {
        if (chart && !chart.isDisposed()) {
          chart.off("finished", handleChartFinished);
          chart.off("click", clickHandler);
          chart.getZr().off("click", zrClickHandler);
          chart.off("mouseover", hoverHandler);
          chart.off("globalout", mouseOutHandler);
        }
      } catch {
        // ignore
      }
    };
  }, [chartData, onBarClick, onBarHover, onBarLeave, onRenderComplete, option]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      if (chartRef.current && containerRef.current) {
        chartRef.current.resize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      try {
        if (chartRef.current && !chartRef.current.isDisposed()) {
          chartRef.current.dispose();
        }
      } catch {
        // ignore
      } finally {
        chartRef.current = null;
      }
    };
  }, []);

  if (data.length === 0) {
    return (
      <Card className={cn("min-w-0", cardClassName)}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className={cn("min-w-0", cardContentClassName)}>
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            No activity data available
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!option) return null;

  return (
    <Card className={cn("min-w-0", cardClassName)}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-start justify-between gap-2 sm:items-center">
          <span className="min-w-0 flex-1 text-balance">{title}</span>
          {latencyBadge}
        </CardTitle>
      </CardHeader>
      <CardContent className={cn("h-[320px] w-full min-w-0 sm:h-[380px] lg:h-[450px]", cardContentClassName)}>
        <div ref={containerRef} className="h-full w-full min-w-0 overflow-hidden" />
      </CardContent>
    </Card>
  );
});
