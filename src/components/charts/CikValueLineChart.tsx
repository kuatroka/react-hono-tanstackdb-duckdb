"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import uPlot from "uplot";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LatencyBadge, type DataFlow } from "@/components/LatencyBadge";
import type { CikQuarterlyData } from "@/collections";

interface CikValueLineChartProps {
  data: readonly CikQuarterlyData[];
  cikName?: string;
  dataLoadMs?: number;
  renderMs?: number;
  source?: "tsdb-api" | "tsdb-indexeddb" | "tsdb-memory" | "unknown";
  onRenderComplete?: (renderMs: number) => void;
}

interface TooltipData {
  quarter: string;
  value: number;
  x: number;
  y: number;
}

function updateTooltip(
  tooltipRef: RefObject<HTMLDivElement | null>,
  tooltipQuarterRef: RefObject<HTMLDivElement | null>,
  tooltipValueRef: RefObject<HTMLDivElement | null>,
  next: TooltipData | null,
) {
  const tooltipElement = tooltipRef.current;
  if (!tooltipElement) {
    return;
  }

  if (!next) {
    tooltipElement.style.opacity = "0";
    tooltipElement.style.visibility = "hidden";
    return;
  }

  tooltipElement.style.opacity = "1";
  tooltipElement.style.visibility = "visible";
  tooltipElement.style.left = `${next.x}px`;
  tooltipElement.style.top = `${next.y - 10}px`;

  if (tooltipQuarterRef.current) {
    tooltipQuarterRef.current.textContent = next.quarter;
  }

  if (tooltipValueRef.current) {
    tooltipValueRef.current.textContent = formatValue(next.value);
  }
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
}: CikValueLineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<uPlot | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipQuarterRef = useRef<HTMLDivElement>(null);
  const tooltipValueRef = useRef<HTMLDivElement>(null);
  const renderStartRef = useRef<number | null>(null);

  // Transform data for uPlot using categorical X-axis (same as InvestorActivityUplotChart)
  const chartData = useMemo(() => {
    if (data.length === 0) return null;

    // Sort by quarter (chronological order)
    // Handles both "2024Q1" and "2024-Q1" formats
    const sorted = [...data].sort((a, b) => {
      const parseQuarter = (q: string) => {
        // Try "2024Q1" format first, then "2024-Q1"
        const match = q.match(/(\d{4})[-]?Q(\d)/);
        if (match) {
          return { year: Number(match[1]), quarter: Number(match[2]) };
        }
        return { year: 0, quarter: 0 };
      };
      const pA = parseQuarter(a.quarter);
      const pB = parseQuarter(b.quarter);
      if (pA.year !== pB.year) return pA.year - pB.year;
      return pA.quarter - pB.quarter;
    });

    const labels = sorted.map((d) => d.quarter);
    const values = sorted.map((d) => d.totalValue);
    const indices = labels.map((_, idx) => idx);

    return { labels, values, indices };
  }, [data]);

  useEffect(() => {
    if (!containerRef.current || !chartData) return;

    renderStartRef.current = performance.now();

    const { labels, values, indices } = chartData;

    const width = containerRef.current.clientWidth;

    // Find min/max for Y axis with padding
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    // Handle single data point case where min === max
    const range = maxVal - minVal;
    const padding = range > 0 ? range * 0.1 : maxVal * 0.1 || 1000;
    const yMin = Math.max(0, minVal - padding);
    const yMax = maxVal + padding;

    const chart = new uPlot(
      {
        width,
        height: 300,
        padding: [16, 16, 48, 16],
        legend: { show: false },
        cursor: {
          drag: { x: false, y: false },
          focus: { prox: 32 },
        },
        scales: {
          x: { time: false, range: [-0.5, labels.length - 0.5] },
          y: {
            range: [yMin, yMax],
          },
        },
        axes: [
          {
            stroke: "#6b7280",
            grid: { stroke: "rgba(148,163,184,0.25)" },
            ticks: { stroke: "rgba(148,163,184,0.25)" },
            // Only show labels at integer positions (actual data points)
            values: (_chart, ticks) => ticks.map((t) => {
              const idx = Math.round(t);
              // Only show label if tick is close to an integer (actual data point)
              if (Math.abs(t - idx) < 0.01 && idx >= 0 && idx < labels.length) {
                return labels[idx];
              }
              return "";
            }),
            gap: 10,
            size: 40,
          },
          {
            stroke: "#6b7280",
            grid: { stroke: "rgba(148,163,184,0.25)" },
            ticks: { stroke: "rgba(148,163,184,0.25)" },
            values: (_chart, ticks) => ticks.map((t) => formatValue(t)),
            gap: 8,
            size: 70,
          },
        ],
        series: [
          {},
          {
            label: "Portfolio Value",
            stroke: "#3b82f6",
            fill: "rgba(59,130,246,0.15)",
            width: 2,
            points: {
              show: true,
              size: 6,
              fill: "#3b82f6",
              stroke: "#3b82f6",
            },
          },
        ],
        hooks: {
          setCursor: [
            (u) => {
              const idx = u.cursor.idx;
              if (idx == null || idx < 0 || idx >= labels.length) {
                updateTooltip(tooltipRef, tooltipQuarterRef, tooltipValueRef, null);
                return;
              }

              const quarter = labels[idx];
              const value = values[idx];

              // Get pixel position for tooltip
              const left = u.valToPos(idx, "x");
              const top = u.valToPos(value, "y");

              updateTooltip(tooltipRef, tooltipQuarterRef, tooltipValueRef, {
                quarter,
                value,
                x: left,
                y: top,
              });
            },
          ],
        },
      },
      [indices, values],
      containerRef.current
    );

    chartRef.current = chart;

    let rafId: number | null = null;
    if (renderStartRef.current != null && onRenderComplete) {
      rafId = requestAnimationFrame(() => {
        if (renderStartRef.current == null) return;
        const elapsed = Math.round(performance.now() - renderStartRef.current);
        onRenderComplete(elapsed);
        renderStartRef.current = null;
      });
    }

    const resizeObserver = new ResizeObserver(() => {
      if (chartRef.current && containerRef.current) {
        const nextWidth = containerRef.current.clientWidth;
        chartRef.current.setSize({ width: nextWidth, height: 300 });
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      if (rafId != null) {
        cancelAnimationFrame(rafId);
      }
      resizeObserver.disconnect();
      updateTooltip(tooltipRef, tooltipQuarterRef, tooltipValueRef, null);
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [chartData, onRenderComplete]);

  if (!chartData || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Value Over Time</CardTitle>
          <CardDescription>No quarterly data available</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Calculate summary stats
  const latestValue = chartData.values[chartData.values.length - 1];
  const earliestValue = chartData.values[0];
  const totalChange =
    earliestValue > 0
      ? ((latestValue - earliestValue) / earliestValue) * 100
      : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>Portfolio Value Over Time{cikName ? ` - ${cikName}` : ""}</span>
          <LatencyBadge
            dataLoadMs={dataLoadMs}
            renderMs={renderMs}
            source={source as DataFlow}
          />
        </CardTitle>
        <CardDescription>
          {data.length} quarters tracked • Latest:{" "}
          {formatValue(latestValue)} • Total change:{" "}
          <span className={totalChange >= 0 ? "text-green-600" : "text-red-600"}>
            {totalChange >= 0 ? "+" : ""}
            {totalChange.toFixed(1)}%
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <div ref={containerRef} className="h-[300px] w-full" />
          <div
            ref={tooltipRef}
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-gray-900 px-3 py-2 text-sm text-white shadow-lg"
            style={{ opacity: 0, visibility: "hidden" }}
          >
            <div ref={tooltipQuarterRef} className="font-semibold" />
            <div ref={tooltipValueRef} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
