"use client";

import ReactECharts from "echarts-for-react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LatencyBadge } from "@/components/LatencyBadge";
import type { CusipQuarterInvestorActivity } from "@/schema";

interface InvestorActivityEchartsChartProps {
  data: readonly CusipQuarterInvestorActivity[];
  ticker: string;
  latencyMs?: number | null;
  latencySource?: string;
}

 type TooltipParam = {
  seriesName?: string;
  value?: number | string;
  axisValueLabel?: string;
};

export function InvestorActivityEchartsChart({ data, ticker, latencyMs, latencySource }: InvestorActivityEchartsChartProps) {
  if (data.length === 0) {
    return (
      <Card>
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

  const chartData = data.map((item) => ({
    quarter: item.quarter ?? "Unknown",
    opened: item.numOpen ?? 0,
    closed: -(item.numClose ?? 0),
  }));

  const quarters = chartData.map((item) => item.quarter);
  const openedValues = chartData.map((item) => item.opened);
  const closedValues = chartData.map((item) => item.closed);

  const maxValue = Math.max(
    ...chartData.map((item) => Math.max(Math.abs(item.opened), Math.abs(item.closed)))
  );
  const maxDomain = maxValue * 1.1;

  const option = {
    grid: { top: 40, right: 20, bottom: 80, left: 60 },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params: TooltipParam[]) => {
        const lines = params.map((p) => {
          const label = p.seriesName;
          const value = Math.abs(Number(p.value));
          return `${label}: ${value.toLocaleString()} investors`;
        });
        return [`<strong>${params[0]?.axisValueLabel ?? ""}</strong>`, ...lines].join("<br/>");
      },
    },
    xAxis: {
      type: "category",
      data: quarters,
      axisLabel: {
        rotate: -45,
        formatter: (value: string) => value,
      },
      axisTick: { alignWithLabel: true },
    },
    yAxis: {
      type: "value",
      min: -maxDomain,
      max: maxDomain,
      axisLabel: {
        formatter: (value: number) => Math.abs(value).toString(),
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
    animationDuration: 600,
  };

  return (
    <Card>
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
      <CardContent className="h-[450px] w-full">
        <ReactECharts option={option} style={{ height: "100%", width: "100%" }} />
      </CardContent>
    </Card>
  );
}
