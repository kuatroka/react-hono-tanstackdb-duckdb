"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent, MarkLineComponent, TooltipComponent } from "echarts/components";
import { LegacyGridContainLabel } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LatencyBadge } from "@/components/LatencyBadge";
import type { CusipQuarterInvestorActivity } from "@/schema";

echarts.use([
  BarChart,
  GridComponent,
  TooltipComponent,
  MarkLineComponent,
  CanvasRenderer,
  LegacyGridContainLabel,
]);

interface InvestorActivityEchartsChartProps {
  data: readonly CusipQuarterInvestorActivity[];
  ticker: string;
  latencyMs?: number | null;
  latencySource?: string;
}

type TooltipParam = {
  axisValueLabel?: string;
  seriesName?: string;
  value?: number | string | null;
};

export const InvestorActivityEchartsChart = memo(function InvestorActivityEchartsChart({
  data,
  ticker,
  latencyMs,
  latencySource,
}: InvestorActivityEchartsChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.EChartsType | null>(null);

  const option = useMemo(() => {
    if (data.length === 0) return null;

    const chartData = data.map((item) => ({
      quarter: item.quarter ?? "Unknown",
      opened: item.numOpen ?? 0,
      closed: -(item.numClose ?? 0),
    }));

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
        formatter: (params: TooltipParam[]) => {
          const lines = params.map((param) => {
            const label = param.seriesName;
            const value = Math.abs(Number(param.value));
            return `${label}: ${value.toLocaleString()} investors`;
          });

          return [`<strong>${params[0]?.axisValueLabel ?? ""}</strong>`, ...lines].join("<br/>");
        },
      },
      xAxis: {
        type: "category",
        data: quarters,
        boundaryGap: true,
        axisTick: { alignWithLabel: true },
        axisLabel: {
          rotate: 0,
          hideOverlap: true,
          interval: "auto",
          formatter: (value: string) => {
            const match = value.match(/^(\d{4})Q(\d)$/);
            if (match) {
              const [, year, quarter] = match;
              return `${year}Q${quarter}`;
            }

            return value;
          },
        },
      },
      yAxis: {
        type: "value",
        min: -maxDomain,
        max: maxDomain,
        splitNumber: 6,
        axisLabel: {
          formatter: (value: number) => {
            const absoluteValue = Math.abs(value);
            if (Math.abs(absoluteValue - maxDomain) < maxDomain * 0.05) {
              return "";
            }

            return absoluteValue.toString();
          },
          margin: 8,
        },
        splitLine: {
          lineStyle: {
            type: "dashed",
            color: "rgba(148,163,184,0.3)",
          },
        },
      },
      series: [
        {
          name: "Opened",
          type: "bar",
          stack: "activity",
          emphasis: { focus: "series" },
          itemStyle: { color: "hsl(142, 76%, 36%)", borderRadius: [4, 4, 0, 0] },
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
          itemStyle: { color: "hsl(0, 84%, 60%)", borderRadius: [0, 0, 4, 4] },
          data: closedValues,
        },
      ],
    };
  }, [data]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !option) return;

    const syncChart = () => {
      const width = container.clientWidth || container.getBoundingClientRect().width;
      const height = container.clientHeight || container.getBoundingClientRect().height;

      if (width <= 0 || height <= 0) return;

      const chart =
        chartRef.current && !chartRef.current.isDisposed()
          ? chartRef.current
          : echarts.getInstanceByDom(container) ??
            echarts.init(container, undefined, {
              renderer: "canvas",
            });

      chartRef.current = chart;
      chart.resize({ width, height });
      chart.setOption(option, {
        notMerge: true,
        lazyUpdate: true,
      });
    };

    syncChart();

    const observer = new ResizeObserver(() => {
      syncChart();
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [option]);

  useEffect(() => {
    return () => {
      try {
        if (chartRef.current && !chartRef.current.isDisposed()) {
          chartRef.current.dispose();
        }
      } catch {
        // ignore cleanup issues during hot reload
      } finally {
        chartRef.current = null;
      }
    };
  }, []);

  if (data.length === 0) {
    return (
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Investor Activity for {ticker} (ECharts)</CardTitle>
          <CardDescription>No activity data available</CardDescription>
          {latencySource && (
            <CardAction>
              <LatencyBadge ms={latencyMs ?? null} source={latencySource} />
            </CardAction>
          )}
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Investor Activity for {ticker} (ECharts)</CardTitle>
        <CardDescription>
          Alternative rendering using Apache ECharts with opened (green) vs closed (red) positions.
        </CardDescription>
        {latencySource && (
          <CardAction>
            <LatencyBadge ms={latencyMs ?? null} source={latencySource} />
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="h-[450px] w-full min-w-0">
        <div ref={containerRef} className="h-full w-full min-w-0" />
      </CardContent>
    </Card>
  );
});

InvestorActivityEchartsChart.displayName = "InvestorActivityEchartsChart";
