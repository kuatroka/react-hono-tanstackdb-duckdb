"use client";

import { useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LatencyBadge, type DataFlow } from "@/components/LatencyBadge";
import type { CikQuarterlyData } from "@/collections";

function cssVar(name: string) {
  if (typeof window === "undefined") return "transparent";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "transparent";
}

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

interface CikValueLineChartProps {
  data: readonly CikQuarterlyData[];
  cikName?: string;
  dataLoadMs?: number;
  renderMs?: number;
  source?: "api-duckdb" | "tsdb-indexeddb" | "tsdb-memory" | "unknown";
  onRenderComplete?: (renderMs: number) => void;
  latencyBadge?: React.ReactNode;
}

interface LineTooltipParam {
  axisValueLabel?: string;
  seriesName?: string;
  value?: number | string | null;
}

interface ChartPoint {
  quarter: string;
  value: number;
}

function parseQuarter(quarter: string) {
  const match = quarter.match(/^(\d{4})-?Q(\d)$/);
  if (!match) {
    return { year: 0, quarter: 0 };
  }

  return {
    year: Number(match[1]),
    quarter: Number(match[2]),
  };
}

function formatQuarterLabel(quarter: string) {
  const match = quarter.match(/^(\d{4})-?Q(\d)$/);
  if (!match) {
    return quarter;
  }

  const [, year, quarterNumber] = match;
  return `Q${quarterNumber} '${year.slice(-2)}`;
}

/**
 * Format large numbers for display (e.g., 1.2B, 500M, 25K)
 */
function formatValue(value: number): string {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

export function CikValueLineChart({
  data,
  cikName,
  dataLoadMs,
  renderMs,
  source = "unknown",
  onRenderComplete,
  latencyBadge,
}: CikValueLineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.EChartsType | null>(null);
  const renderStartRef = useRef<number | null>(null);

  const chartData = useMemo<ChartPoint[]>(() => {
    if (data.length === 0) return [];

    return [...data]
      .sort((left, right) => {
        const parsedLeft = parseQuarter(left.quarter);
        const parsedRight = parseQuarter(right.quarter);
        if (parsedLeft.year !== parsedRight.year) {
          return parsedLeft.year - parsedRight.year;
        }
        return parsedLeft.quarter - parsedRight.quarter;
      })
      .map((point) => ({
        quarter: point.quarter,
        value: point.totalValue,
      }));
  }, [data]);

  const option = useMemo<echarts.EChartsCoreOption | null>(() => {
    if (chartData.length === 0) return null;

    return {
      animation: false,
      backgroundColor: cssVar("--chart-bg"),
      textStyle: {
        color: cssVar("--chart-axis"),
        fontFamily: "var(--font-sans)",
      },
      grid: {
        top: 48,
        right: 32,
        bottom: 72,
        left: 56,
        containLabel: true,
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "line" },
        formatter: (params: LineTooltipParam[] | LineTooltipParam) => {
          const point = Array.isArray(params) ? params[0] : params;
          const quarter = point?.axisValueLabel ?? "";
          const value = Number(point?.value ?? 0);

          return [
            `<strong>${quarter}</strong>`,
            `${point?.seriesName ?? "Portfolio Value"}: ${formatValue(value)}`,
          ].join("<br/>");
        },
      },
      xAxis: {
        type: "category",
        data: chartData.map((point) => point.quarter),
        boundaryGap: false,
        axisLabel: {
          hideOverlap: true,
          formatter: (value: string) => formatQuarterLabel(value),
        },
      },
      yAxis: {
        type: "value",
        axisLabel: {
          formatter: (value: number) => formatValue(value),
        },
        splitLine: {
          lineStyle: {
            type: "dashed",
            color: cssVar("--chart-grid"),
          },
        },
      },
      series: [
        {
          name: "Portfolio Value",
          type: "line",
          data: chartData.map((point) => point.value),
          smooth: true,
          showSymbol: true,
          symbol: "circle",
          symbolSize: 6,
          lineStyle: {
            width: 2,
            color: cssVar("--chart-line-primary"),
          },
          itemStyle: {
            color: cssVar("--chart-line-primary"),
          },
          areaStyle: {
            color: cssVar("--chart-line-fill"),
          },
          emphasis: {
            focus: "series",
          },
        },
      ],
    };
  }, [chartData]);

  useEffect(() => {
    if (chartData.length === 0) {
      renderStartRef.current = null;
      if (chartRef.current && !chartRef.current.isDisposed()) {
        chartRef.current.dispose();
      }
      chartRef.current = null;
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

    chart.on("finished", handleChartFinished);
    chart.resize({ width, height });
    chart.setOption(option, {
      notMerge: true,
      lazyUpdate: false,
    });

    return () => {
      try {
        if (chart && !chart.isDisposed()) {
          chart.off("finished", handleChartFinished);
        }
      } catch {
        // ignore
      }
    };
  }, [onRenderComplete, option]);

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

  if (!chartData.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Value Over Time</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-start justify-between gap-2 sm:items-center">
          <span className="min-w-0 flex-1 text-balance">Portfolio Value Over Time{cikName ? ` - ${cikName}` : ""}</span>
          {latencyBadge ?? (
            <LatencyBadge
              dataLoadMs={dataLoadMs}
              renderMs={renderMs}
              source={source as DataFlow}
            />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[280px] w-full min-w-0 sm:h-[320px]">
        <div ref={containerRef} className="h-full w-full min-w-0 overflow-hidden" />
      </CardContent>
    </Card>
  );
}
