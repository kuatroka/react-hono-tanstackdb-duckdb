"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { cn } from "@/lib/utils";
import { useSuperinvestorAssetHistoryData } from "./useSuperinvestorAssetHistoryData";

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

interface SuperinvestorAssetJourneySparklineProps {
  ticker: string;
  cusip: string;
  cik: string;
  selectedQuarter?: string | null;
  latestAvailableQuarter?: string | null;
  className?: string;
}

interface SparklineDatum {
  quarter: string;
  shares: number;
  value: number;
  action: string | null;
  isSelected: boolean;
  isOpenMarker: boolean;
  isCloseMarker: boolean;
}

function formatCompactNumber(value: number) {
  const absoluteValue = Math.abs(value);
  if (absoluteValue >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (absoluteValue >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (absoluteValue >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function formatCurrency(value: number) {
  return `$${formatCompactNumber(value)}`;
}

function formatQuarter(quarter: string) {
  return quarter.replace("-", "");
}

function parseQuarter(quarter: string) {
  const match = quarter.match(/^(\d{4})-?Q([1-4])$/);
  if (!match) {
    return null;
  }
  return {
    year: Number(match[1]),
    quarter: Number(match[2]),
  };
}

function compareQuarter(left: string, right: string) {
  const parsedLeft = parseQuarter(left);
  const parsedRight = parseQuarter(right);
  if (!parsedLeft || !parsedRight) {
    return left.localeCompare(right);
  }
  return parsedLeft.year === parsedRight.year
    ? parsedLeft.quarter - parsedRight.quarter
    : parsedLeft.year - parsedRight.year;
}

function buildQuarterRange(startQuarter: string, endQuarter: string) {
  const start = parseQuarter(startQuarter);
  const end = parseQuarter(endQuarter);
  if (!start || !end) {
    return [endQuarter];
  }

  const quarters: string[] = [];
  let year = start.year;
  let quarter = start.quarter;
  while (year < end.year || (year === end.year && quarter <= end.quarter)) {
    quarters.push(`${year}Q${quarter}`);
    quarter += 1;
    if (quarter > 4) {
      quarter = 1;
      year += 1;
    }
  }
  return quarters;
}

export const SuperinvestorAssetJourneySparkline = memo(function SuperinvestorAssetJourneySparkline({
  ticker,
  cusip,
  cik,
  selectedQuarter = null,
  latestAvailableQuarter = null,
  className,
}: SuperinvestorAssetJourneySparklineProps) {
  const { rows, isLoading } = useSuperinvestorAssetHistoryData(ticker, cusip, cik);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.EChartsType | null>(null);

  const chartData = useMemo<SparklineDatum[]>(() => {
    const latestQuarter = latestAvailableQuarter ?? rows.at(-1)?.quarter ?? selectedQuarter ?? "1999Q1";
    const quarterRange = buildQuarterRange("1999Q1", latestQuarter);
    const sortedRows = [...rows].sort((left, right) => compareQuarter(left.quarter, right.quarter));
    const rowsByQuarter = new Map(sortedRows.map((row) => [row.quarter, row] as const));
    const firstOpenQuarter = sortedRows.find((row) => row.action === "open")?.quarter ?? null;

    return quarterRange.map((quarter) => {
      const row = rowsByQuarter.get(quarter);
      const action = row?.action ?? null;
      return {
        quarter,
        shares: Math.max(row?.sharesCurrentAdj ?? 0, 0),
        value: Math.max(row?.positionValue ?? 0, 0),
        action,
        isSelected: selectedQuarter === quarter,
        isOpenMarker: firstOpenQuarter === quarter,
        isCloseMarker: action === "close",
      };
    });
  }, [latestAvailableQuarter, rows, selectedQuarter]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || chartData.length === 0) {
      return;
    }

    const chart = echarts.getInstanceByDom(container) ?? echarts.init(container, undefined, {
      renderer: "canvas",
    });
    chartRef.current = chart;
    const foregroundVar = getComputedStyle(container).getPropertyValue("--foreground").trim();
    const foregroundColor = foregroundVar ? `hsl(${foregroundVar})` : "rgb(15, 23, 42)";
    const markerFloor = Math.max(...chartData.map((entry) => entry.shares), 1) * 0.035;

    chart.setOption({
      animation: false,
      grid: {
        top: 1,
        bottom: 1,
        left: 0,
        right: 0,
        containLabel: false,
      },
      tooltip: {
        trigger: "axis",
        appendToBody: true,
        confine: false,
        axisPointer: {
          type: "shadow",
          shadowStyle: {
            color: "rgba(148, 163, 184, 0.12)",
          },
        },
        backgroundColor: "rgba(15, 23, 42, 0.96)",
        borderWidth: 0,
        textStyle: {
          color: "#f8fafc",
          fontSize: 11,
        },
        extraCssText: "z-index:999999; border-radius: 8px;",
        padding: 8,
        formatter: (params: unknown) => {
          const item = Array.isArray(params) ? params[0] : params;
          if (!item || typeof item !== "object" || !("data" in item)) {
            return "";
          }
          const point = (item as { data?: { quarter: string; shares: number; valueAmount: number } }).data;
          if (!point) {
            return "";
          }
          return [
            `<div style="font-weight:600;margin-bottom:4px;">${formatQuarter(point.quarter)}</div>`,
            `<div>Shares: ${formatCompactNumber(point.shares)}</div>`,
            `<div>Value: ${formatCurrency(point.valueAmount ?? 0)}</div>`,
          ].join("");
        },
      },
      xAxis: {
        type: "category",
        data: chartData.map((entry) => entry.quarter),
        show: false,
      },
      yAxis: {
        type: "value",
        show: false,
        min: 0,
      },
      series: [
        {
          type: "bar",
          data: chartData.map((entry) => {
            const isOutline = entry.isOpenMarker || entry.isCloseMarker;
            return {
              value: entry.shares > 0 ? entry.shares : (isOutline ? markerFloor : 0),
              quarter: entry.quarter,
              shares: entry.shares,
              valueAmount: entry.value,
              itemStyle: {
                color: isOutline ? "rgba(255,255,255,0)" : foregroundColor,
                opacity: entry.shares > 0 || isOutline ? 1 : 0,
                borderColor: foregroundColor,
                borderWidth: isOutline || entry.isSelected ? 1 : 0,
                borderRadius: 0,
              },
            };
          }),
          barCategoryGap: "0%",
          barGap: "0%",
          barWidth: "100%",
          silent: false,
        },
      ],
    });

    const resizeObserver = new ResizeObserver(() => {
      chart.resize();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (!chart.isDisposed()) {
        chart.dispose();
      }
      chartRef.current = null;
    };
  }, [chartData]);

  if (isLoading && chartData.length === 0) {
    return <div className={cn("h-7 w-full animate-pulse rounded-sm bg-muted/50", className)} />;
  }

  if (chartData.length === 0) {
    return (
      <div className={cn("flex h-6 w-full items-center text-xs text-muted-foreground", className)}>
        No journey yet
      </div>
    );
  }

  return <div ref={containerRef} className={cn("h-6 w-full min-w-[8rem]", className)} aria-label="Journey sparkline" />;
});
