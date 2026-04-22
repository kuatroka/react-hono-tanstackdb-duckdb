"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import uPlot from "uplot";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type InvestorFlow } from "@/types";

function cssVar(name: string) {
  if (typeof window === "undefined") return "transparent";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "transparent";
}

const MAX_VISIBLE_QUARTER_LABELS = 8;

// Register only the modules this chart needs for tree shaking

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

interface InvestorFlowChartProps {
  data: readonly InvestorFlow[];
  ticker: string;
  latencyBadge?: React.ReactNode;
  /** Callback when chart render completes with render time in ms */
  onRenderComplete?: (renderMs: number) => void;
}

interface InvestorFlowTooltipParam {
  axisValueLabel?: string;
  data?: InvestorFlowBarPoint | null;
}

interface InvestorFlowChartPoint {
  quarter: string;
  inflow: number;
  outflow: number;
  netFlow: number;
}

interface InvestorFlowBarPoint extends InvestorFlowChartPoint {
  value: number;
  itemStyle: {
    color: string;
    borderRadius: [number, number, number, number];
  };
}

function normalizeQuarterLabel(value: string): string {
  const dashedMatch = value.match(/^(\d{4})-Q(\d)$/);
  if (dashedMatch) {
    const [, year, quarter] = dashedMatch;
    return `${year}Q${quarter}`;
  }

  return value;
}

function formatQuarterLabel(value: string): string {
  return normalizeQuarterLabel(value);
}

function formatTooltipQuarter(value: string): string {
  return normalizeQuarterLabel(value);
}

function formatCompactDollarTick(value: number): string {
  const absoluteValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (absoluteValue >= 1_000_000_000_000) {
    return `${sign}$${Math.round(absoluteValue / 1_000_000_000_000)}T`;
  }
  if (absoluteValue >= 1_000_000_000) {
    return `${sign}$${Math.round(absoluteValue / 1_000_000_000)}B`;
  }
  if (absoluteValue >= 1_000_000) {
    return `${sign}$${Math.round(absoluteValue / 1_000_000)}M`;
  }
  return `${sign}$${Math.round(absoluteValue)}`;
}

function formatDetailedDollarValue(
  value: number,
  includePositiveSign = false,
): string {
  const absoluteValue = Math.abs(value);
  const sign = value < 0 ? "-" : includePositiveSign && value > 0 ? "+" : "";

  if (absoluteValue >= 1_000_000_000_000) {
    return `${sign}$${(absoluteValue / 1_000_000_000_000).toFixed(1)}T`;
  }
  if (absoluteValue >= 1_000_000_000) {
    return `${sign}$${(absoluteValue / 1_000_000_000).toFixed(1)}B`;
  }
  if (absoluteValue >= 1_000_000) {
    return `${sign}$${(absoluteValue / 1_000_000).toFixed(1)}M`;
  }
  return `${sign}$${Math.round(absoluteValue).toLocaleString()}`;
}

function getNetFlowColor(value: number): string {
  if (value > 0) return cssVar("--chart-bar-positive");
  if (value < 0) return cssVar("--chart-bar-negative");
  return cssVar("--chart-bar-neutral");
}

function calculateQuarterLabelInterval(length: number): number {
  if (length <= MAX_VISIBLE_QUARTER_LABELS) {
    return 0;
  }

  return Math.ceil(length / MAX_VISIBLE_QUARTER_LABELS) - 1;
}

function InvestorFlowCard({
  title,
  latencyBadge,
  children,
}: {
  title: string;
  latencyBadge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-start justify-between gap-2 sm:items-center">
          <span className="min-w-0 flex-1 text-balance">{title}</span>
          {latencyBadge}
        </CardTitle>
      </CardHeader>
      <CardContent className="min-w-0 overflow-hidden">{children}</CardContent>
    </Card>
  );
}

function EmptyInvestorFlowCard({
  ticker,
  title,
}: {
  ticker: string;
  title: string;
}) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>
          {title} for {ticker}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}

export const InvestorFlowChart = memo(function InvestorFlowChart({
  data,
  ticker,
  latencyBadge,
  onRenderComplete,
}: InvestorFlowChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.EChartsType | null>(null);
  const renderStartRef = useRef<number | null>(null);
  const prevDataSignatureRef = useRef<string>("");

  const chartData = useMemo<InvestorFlowChartPoint[]>(
    () =>
      data.map((item) => ({
        quarter: item.quarter,
        inflow: item.inflow,
        outflow: item.outflow,
        netFlow: item.inflow - item.outflow,
      })),
    [data],
  );

  const option = useMemo<echarts.EChartsCoreOption | null>(() => {
    if (chartData.length === 0) return null;

    const quarterLabelInterval = calculateQuarterLabelInterval(
      chartData.length,
    );
    const seriesData: InvestorFlowBarPoint[] = chartData.map((item) => ({
      value: item.netFlow,
      quarter: item.quarter,
      inflow: item.inflow,
      outflow: item.outflow,
      netFlow: item.netFlow,
      itemStyle: {
        color: getNetFlowColor(item.netFlow),
        borderRadius: item.netFlow >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4],
      },
    }));

    return {
      animation: false,
      backgroundColor: cssVar("--chart-bg"),
      textStyle: {
        color: cssVar("--chart-axis"),
        fontFamily: "var(--font-sans)",
      },
      grid: {
        top: 32,
        right: 24,
        bottom: 72,
        left: 76,
        containLabel: true,
      },
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "shadow",
        },
        formatter: (
          params: InvestorFlowTooltipParam[] | InvestorFlowTooltipParam,
        ) => {
          const rows = Array.isArray(params) ? params : [params];
          const point = rows[0]?.data;
          if (!point) {
            return `<strong>${rows[0]?.axisValueLabel ?? ""}</strong>`;
          }

          const netFlowColor = getNetFlowColor(point.netFlow);
          const netFlowText = formatDetailedDollarValue(point.netFlow, true);

          return `
                        <div style="display:flex; gap:12px; align-items:stretch;">
                            <div style="width:2px; border-radius:9999px; background:${netFlowColor};"></div>
                            <div>
                                <div style="display:flex; gap:12px; align-items:baseline; margin-bottom:4px;">
                                    <strong>${formatTooltipQuarter(point.quarter)}</strong>
                                    <strong style="color:${netFlowColor};"> ${netFlowText}</strong>
                                </div>
                                <div>Inflow: ${formatDetailedDollarValue(point.inflow)}</div>
                                <div>Outflow: ${formatDetailedDollarValue(point.outflow)}</div>
                            </div>
                        </div>
                    `;
        },
      },
      xAxis: {
        type: "category",
        data: chartData.map((item) => item.quarter),
        axisTick: {
          alignWithLabel: true,
          interval: quarterLabelInterval,
        },
        axisLabel: {
          hideOverlap: true,
          interval: quarterLabelInterval,
          formatter: formatQuarterLabel,
        },
        axisLine: {
          lineStyle: {
            color: "rgba(148,163,184,0.55)",
          },
        },
      },
      yAxis: {
        type: "value",
        axisLabel: {
          formatter: (value: number) => formatCompactDollarTick(value),
        },
        axisLine: {
          show: false,
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
          name: "Net Flow",
          type: "bar",
          barMaxWidth: 22,
          emphasis: {
            focus: "series",
          },
          markLine: {
            silent: true,
            symbol: "none",
            label: { show: false },
            lineStyle: {
              color: cssVar("--chart-zero-line"),
              width: 3,
              type: "solid",
            },
            data: [{ yAxis: 0 }],
          },
          data: seriesData,
        },
      ],
    };
  }, [chartData]);

  useEffect(() => {
    const nextSignature = JSON.stringify(
      chartData.map((item) => [item.quarter, item.inflow, item.outflow]),
    );
    if (
      chartData.length > 0 &&
      nextSignature !== prevDataSignatureRef.current
    ) {
      renderStartRef.current = performance.now();
      prevDataSignatureRef.current = nextSignature;
    }
  }, [chartData]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !option) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width <= 0 || height <= 0) return;

    const chartInstance =
      echarts.getInstanceByDom(container) ??
      echarts.init(container, undefined, {
        renderer: "canvas",
        width,
        height,
      });

    chartRef.current = chartInstance;
    chartInstance.resize({
      width,
      height,
    });

    const handleFinished = () => {
      if (renderStartRef.current != null && onRenderComplete) {
        const elapsed = Math.round(performance.now() - renderStartRef.current);
        onRenderComplete(elapsed);
        renderStartRef.current = null;
      }
    };

    chartInstance.off("finished", handleFinished);
    chartInstance.on("finished", handleFinished);
    chartInstance.setOption(option, { notMerge: true, lazyUpdate: true });
    handleFinished();

    return () => {
      chartInstance.off("finished", handleFinished);
    };
  }, [option, onRenderComplete]);

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
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  if (data.length === 0) {
    return <EmptyInvestorFlowCard ticker={ticker} title="Net Investor Flow" />;
  }

  return (
    <InvestorFlowCard
      title={`Net Investor Flow ${ticker}`}
      latencyBadge={latencyBadge}
    >
      <div ref={containerRef} className="h-[300px] w-full min-w-0 overflow-hidden sm:h-[360px] lg:h-[400px]" />
    </InvestorFlowCard>
  );
});

export const InvestorFlowUplotChart = memo(function InvestorFlowUplotChart({
  data,
  ticker,
  latencyBadge,
  onRenderComplete,
}: InvestorFlowChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<uPlot | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || data.length === 0) return;

    const renderStartedAt = performance.now();
    const labels = data.map((item) => item.quarter);
    const inflow = data.map((item) => item.inflow);
    const outflow = data.map((item) => item.outflow);
    const indices = labels.map((_, index) => index);

    const chart = new uPlot(
      {
        title: `Investor Flow (${ticker})`,
        width: container.clientWidth,
        height: 400,
        padding: [16, 24, 48, 16],
        legend: { show: true },
        scales: {
          x: { time: false, range: [-0.5, labels.length - 0.5] },
          y: { auto: true },
        },
        axes: [
          {
            stroke: "#6b7280",
            grid: { stroke: "rgba(148,163,184,0.25)" },
            values: (_chart, ticks) =>
              ticks.map((tick) => {
                const label = labels[Math.round(tick)] ?? "";
                const match = label.match(/^(\d{4})-Q(\d)$/);
                if (match) {
                  const [, year, quarter] = match;
                  return `Q${quarter} '${year.slice(-2)}`;
                }
                return label;
              }),
            gap: 10,
          },
          {
            stroke: "#6b7280",
            grid: { stroke: "rgba(148,163,184,0.25)" },
          },
        ],
        series: [
          {},
          {
            label: "Inflow",
            stroke: "#15803d",
            width: 3,
            points: { show: false },
            paths: uPlot.paths.spline!(),
          },
          {
            label: "Outflow",
            stroke: "#dc2626",
            width: 3,
            points: { show: false },
            paths: uPlot.paths.spline!(),
          },
        ],
      },
      [indices, inflow, outflow],
      container,
    );

    chartRef.current = chart;

    let rafId: number | null = null;
    if (onRenderComplete) {
      rafId = requestAnimationFrame(() => {
        onRenderComplete(Math.round(performance.now() - renderStartedAt));
      });
    }

    const resizeObserver = new ResizeObserver(() => {
      if (chartRef.current && containerRef.current) {
        chartRef.current.setSize({
          width: containerRef.current.clientWidth,
          height: 400,
        });
      }
    });

    resizeObserver.observe(container);

    return () => {
      if (rafId != null) {
        cancelAnimationFrame(rafId);
      }
      resizeObserver.disconnect();
      chart.destroy();
      chartRef.current = null;
    };
  }, [data, ticker, onRenderComplete]);

  if (data.length === 0) {
    return (
      <EmptyInvestorFlowCard ticker={ticker} title="Investor Flow (uPlot)" />
    );
  }

  return (
    <InvestorFlowCard
      title={`Investor Flow for ${ticker} (uPlot)`}
      latencyBadge={latencyBadge}
    >
      <div ref={containerRef} className="h-[400px] w-full min-w-0" />
    </InvestorFlowCard>
  );
});
