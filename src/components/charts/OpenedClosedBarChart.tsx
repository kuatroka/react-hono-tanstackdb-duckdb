"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  MarkLineComponent,
} from "echarts/components";
import { LegacyGridContainLabel } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { QuarterlyActivityPoint } from "@/types/duckdb";

// Register only the components we need for tree shaking
echarts.use([
  BarChart,
  GridComponent,
  TooltipComponent,
  MarkLineComponent,
  CanvasRenderer,
  LegacyGridContainLabel,
]);

interface OpenedClosedBarChartProps {
  /** Array of quarterly data points with opened/closed counts */
  data: readonly QuarterlyActivityPoint[];
  /** Chart title */
  title: string;
  /** Optional description shown below title */
  description?: string;
  /** Callback when a bar is clicked */
  onBarClick?: (selection: { quarter: string; action: "open" | "close" }) => void;
  /** Callback when a bar is hovered */
  onBarHover?: (selection: { quarter: string; action: "open" | "close" }) => void;
  /** Callback when mouse leaves a bar */
  onBarLeave?: () => void;
  /** Unit label for tooltip (default: "positions") */
  unitLabel?: string;
  /** Optional latency badge */
  latencyBadge?: React.ReactNode;
  /** Callback when chart render completes with render time in ms */
  onRenderComplete?: (renderMs: number) => void;
}

interface OpenedClosedChartEvent {
  name?: string;
  seriesName?: string;
}

interface OpenedClosedTooltipParam {
  axisValueLabel?: string;
  seriesName?: string;
  value?: number | string | null;
}

/**
 * Reusable ECharts bar chart for opened/closed positions by quarter.
 * - Opened positions shown as green bars above zero
 * - Closed positions shown as red bars below zero
 * 
 * Used for both:
 * - Per-asset investor activity (AssetDetail page)
 * - All-assets aggregated activity (Dashboard/Overview)
 */
export function OpenedClosedBarChart({
  data,
  title,
  description,
  onBarClick,
  onBarHover,
  onBarLeave,
  unitLabel = "positions",
  latencyBadge,
  onRenderComplete,
}: OpenedClosedBarChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.EChartsType | null>(null);
  const [chartSize, setChartSize] = useState<{ width: number; height: number } | null>(null);
  const renderStartRef = useRef<number | null>(null);
  const prevDataLengthRef = useRef<number>(0);

  // Track render start when data changes
  useEffect(() => {
    if (data.length > 0 && data.length !== prevDataLengthRef.current) {
      renderStartRef.current = performance.now();
      prevDataLengthRef.current = data.length;
    }
  }, [data]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;

      if (width > 0 && height > 0) {
        setChartSize((current) => {
          if (current?.width === width && current?.height === height) {
            return current;
          }
          return { width, height };
        });
      }
    };

    updateSize();

    const observer = new ResizeObserver(() => {
      updateSize();
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const chartData = useMemo(() => {
    return data.map((item) => ({
      quarter: item.quarter ?? "Unknown",
      opened: item.opened ?? 0,
      closed: -(item.closed ?? 0), // Negative for below-zero display
    }));
  }, [data]);

  const option = useMemo(() => {
    if (chartData.length === 0) return null;

    const quarters = chartData.map((item) => item.quarter);
    const openedValues = chartData.map((item) => item.opened);
    const closedValues = chartData.map((item) => item.closed);

    const maxValue = Math.max(
      1, // Prevent division by zero
      ...chartData.map((item) => Math.max(Math.abs(item.opened), Math.abs(item.closed)))
    );
    const maxDomain = maxValue * 1.1;

    return {
      animation: false,
      grid: { 
        top: 48, 
        right: 48,
        bottom: 80, 
        left: 48, 
        containLabel: true 
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: OpenedClosedTooltipParam[]) => {
          const lines = params.map((p) => {
            const label = p.seriesName;
            const value = Math.abs(Number(p.value));
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
          interval: 'auto',
          formatter: (value: string) => {
            if (!quarters.includes(value)) return '';
            // Format as "Q1 '24" for compact display
            const match = value.match(/^(\d{4})-Q(\d)$/);
            if (match) {
              const [, year, quarter] = match;
              return `Q${quarter} '${year.slice(-2)}`;
            }
            return value;
          },
        },
        axisTick: { alignWithLabel: true },
      },
      yAxis: {
        type: "value",
        min: -maxDomain,
        max: maxDomain,
        splitNumber: 6,
          axisLabel: {
            formatter: (value: number) => {
              const absValue = Math.abs(value);
              if (Math.abs(absValue - maxDomain) < maxDomain * 0.05) return '';
              return absValue.toString();
            },
            margin: 8,
          },
        splitLine: {
          lineStyle: {
            type: "dashed",
            color: "rgba(148,163,184,0.3)",
          },
        },
        position: 'left',
      },
      series: [
        {
          name: "Opened",
          type: "bar",
          stack: "activity",
          emphasis: { focus: "series" },
          itemStyle: { 
            color: "hsl(142, 76%, 36%)", 
            borderRadius: [4, 4, 0, 0] 
          },
          data: openedValues,
          markLine: {
            silent: true,
            symbol: "none",
            label: { show: false },
            lineStyle: {
              color: "hsl(var(--foreground))",
              width: 1,
              opacity: 0.4,
            },
            data: [{ yAxis: 0 }],
          },
        },
        {
          name: "Closed",
          type: "bar",
          stack: "activity",
          emphasis: { focus: "series" },
          itemStyle: { 
            color: "hsl(0, 84%, 60%)", 
            borderRadius: [0, 0, 4, 4] 
          },
          data: closedValues,
        },
      ],
    };
  }, [chartData, unitLabel]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !option || !chartSize) return;

    const chartInstance =
      echarts.getInstanceByDom(container) ??
      echarts.init(container, undefined, {
        renderer: "canvas",
        width: chartSize.width,
        height: chartSize.height,
      });

    chartRef.current = chartInstance;
    chartInstance.resize({
      width: chartSize.width,
      height: chartSize.height,
    });
    chartInstance.setOption(option, {
      notMerge: false,
      lazyUpdate: false,
    });

    // Signal render complete after chart is set up
    if (renderStartRef.current != null && onRenderComplete) {
      const elapsed = Math.round(performance.now() - renderStartRef.current);
      onRenderComplete(elapsed);
      renderStartRef.current = null;
    }

    const clickHandler = (params: OpenedClosedChartEvent) => {
      if (!onBarClick || !params.name || !params.seriesName) return;

      const quarter = params.name as string;
      const action = params.seriesName === "Opened" ? "open" : "close";

      onBarClick({ quarter, action });
    };

    const hoverHandler = (params: OpenedClosedChartEvent) => {
      if (!onBarHover || !params.name || !params.seriesName) return;

      const quarter = params.name as string;
      const action = params.seriesName === "Opened" ? "open" : "close";

      onBarHover({ quarter, action });
    };

    const mouseOutHandler = () => {
      if (onBarLeave) {
        onBarLeave();
      }
    };

    chartInstance.on('click', clickHandler);
    chartInstance.on('mouseover', hoverHandler);
    chartInstance.on('globalout', mouseOutHandler);

    return () => {
      try {
        if (chartInstance && !chartInstance.isDisposed()) {
          chartInstance.off('click', clickHandler);
          chartInstance.off('mouseover', hoverHandler);
          chartInstance.off('globalout', mouseOutHandler);
        }
      } catch {
        // ignore
      }
    };
  }, [chartSize, onBarClick, onBarHover, onBarLeave, option]);

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
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent className="min-w-0">
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            No activity data available
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!option) return null;

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>{title}</span>
          {latencyBadge}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="h-[450px] w-full min-w-0">
        <div ref={containerRef} className="h-full w-full min-w-0" />
      </CardContent>
    </Card>
  );
}
