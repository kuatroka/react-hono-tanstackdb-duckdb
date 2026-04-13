"use client";

import { useEffect, useRef } from "react";
import { Chart } from "@antv/g2";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CusipQuarterInvestorActivity } from "@/schema";

interface InvestorActivityG2ChartProps {
  data: readonly CusipQuarterInvestorActivity[];
  ticker: string;
}

interface ChartDatum {
  quarter: string;
  type: "Opened" | "Closed";
  value: number;
}

export function InvestorActivityG2Chart({ data, ticker }: InvestorActivityG2ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    const chartData: ChartDatum[] = data.flatMap((item) => {
      const quarter = item.quarter ?? "Unknown";
      return [
        {
          quarter,
          type: "Opened",
          value: item.numOpen ?? 0,
        },
        {
          quarter,
          type: "Closed",
          value: -(item.numClose ?? 0),
        },
      ];
    });

    const maxValue = Math.max(
      ...chartData.map((entry) => Math.abs(entry.value))
    );
    const maxDomain = maxValue * 1.1 || 1;

    const chart = new Chart({
      container: containerRef.current,
      autoFit: true,
      height: 400,
    });

    const option: Parameters<Chart["options"]>[0] = {
      type: "interval",
      padding: { top: 40, right: 60, bottom: 80, left: 60 },
      data: chartData,
      transform: [{ type: "stackY" }],
      encode: {
        x: "quarter",
        y: "value",
        color: "type",
      },
      scale: {
        y: { domain: [-maxDomain, maxDomain] },
        color: {
          range: ["hsl(142, 76%, 36%)", "hsl(0, 84%, 60%)"],
        },
      },
      axis: {
        x: {
          labelTransform: "rotate(-45)",
          labelSpacing: 6,
        },
        y: {
          labelFormatter: (val: number) => Math.abs(val).toString(),
        },
      },
      tooltip: {
        title: (datum: ChartDatum) => datum.quarter,
        valueFormatter: (value: number) =>
          `${Math.abs(value).toLocaleString()} investors`,
      },
      guides: [
        {
          type: "lineY",
          value: 0,
          style: {
            stroke: "hsl(var(--foreground))",
            lineWidth: 1,
            opacity: 0.4,
          },
        },
      ],
    };

    chart.options(option);

    chart.render();
    chartRef.current = chart;

    return () => {
      chart.destroy();
      chartRef.current = null;
    };
  }, [data, ticker]);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Investor Activity for {ticker} (G2)</CardTitle>
          <CardDescription>No activity data available</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Investor Activity for {ticker} (G2)</CardTitle>
        <CardDescription>
          Alternative rendering using AntV G2 with opened (green) vs closed (red) positions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div ref={containerRef} className="h-[400px] w-full" />
      </CardContent>
    </Card>
  );
}
