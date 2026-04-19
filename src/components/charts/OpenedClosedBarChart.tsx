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
  name?: string;
  seriesName?: string;
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
            color: "rgba(148,163,184,0.3)",
          },
        },
        position: "left",
      },
      series: [
        {
          name: "Opened",
          type: "bar",
          stack: "activity",
          emphasis: { focus: "series" },
          itemStyle: {
            color: "hsl(142, 76%, 36%)",
            borderRadius: [4, 4, 0, 0],
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
            borderRadius: [0, 0, 4, 4],
          },
          data: closedValues,
        },
      ],
    };
  }, [chartData, unitLabel]);

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
      if (!onBarClick || !params.name || !params.seriesName) return;
      const quarter = params.name;
      const action = params.seriesName === "Opened" ? "open" : "close";
      onBarClick({ quarter, action });
    };

    const hoverHandler = (params: OpenedClosedChartEvent) => {
      if (!onBarHover || !params.name || !params.seriesName) return;
      const quarter = params.name;
      const action = params.seriesName === "Opened" ? "open" : "close";
      onBarHover({ quarter, action });
    };

    const mouseOutHandler = () => {
      onBarLeave?.();
    };

    chart.on("finished", handleChartFinished);
    chart.on("click", clickHandler);
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
          chart.off("mouseover", hoverHandler);
          chart.off("globalout", mouseOutHandler);
        }
      } catch {
        // ignore
      }
    };
  }, [onBarClick, onBarHover, onBarLeave, onRenderComplete, option]);

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
        <CardTitle className="flex items-center justify-between gap-2">
          <span>{title}</span>
          {latencyBadge}
        </CardTitle>
      </CardHeader>
      <CardContent className={cn("h-[450px] w-full min-w-0", cardContentClassName)}>
        <div ref={containerRef} className="h-full w-full min-w-0" />
      </CardContent>
    </Card>
  );
});
