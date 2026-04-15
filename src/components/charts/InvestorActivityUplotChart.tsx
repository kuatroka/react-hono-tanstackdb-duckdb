"use client";

import { memo, useEffect, useRef } from "react";
import uPlot from "uplot";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CusipQuarterInvestorActivity } from "@/schema";

type UplotInteractionChart = uPlot & {
  valToPos(value: number, scaleKey: string, can: boolean): number;
  posToIdx(position: number): number | null;
};

interface InvestorActivityUplotChartProps {
  data: readonly CusipQuarterInvestorActivity[];
  ticker: string;
  onBarClick?: (payload: { quarter: string; action: "open" | "close" }) => void;
  onBarHover?: (payload: { quarter: string; action: "open" | "close" }) => void;
  onBarLeave?: () => void;
  latencyBadge?: React.ReactNode;
  /** Callback when chart render completes with render time in ms */
  onRenderComplete?: (renderMs: number) => void;
}

export const InvestorActivityUplotChart = memo(function InvestorActivityUplotChart({
  data,
  ticker,
  onBarClick,
  onBarHover,
  onBarLeave,
  latencyBadge,
  onRenderComplete,
}: InvestorActivityUplotChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<uPlot | null>(null);
  const lastHoverRef = useRef<{ quarter: string; action: "open" | "close" } | null>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    const renderStartedAt = performance.now();

    const labels = data.map((item) => item.quarter ?? "Unknown");
    const opened = data.map((item) => item.numOpen ?? 0);
    const closed = data.map((item) => -(item.numClose ?? 0));
    const indices = labels.map((_, idx) => idx);

    const width = containerRef.current.clientWidth;

    const chart = new uPlot(
      {
        title: `Investor Activity (uPlot)` ,
        width,
        height: 400,
        padding: [16, 40, 48, 16],
        legend: { show: true },
        scales: {
          x: { time: false, range: [-0.5, labels.length - 0.5] },
          y: { auto: true },
        },
        axes: [
          {
            stroke: "#6b7280",
            grid: { stroke: "rgba(148,163,184,0.25)" },
            values: (_chart, ticks) => ticks.map((t) => labels[Math.round(t)] ?? ""),
            gap: 10,
          },
          {
            stroke: "#6b7280",
            grid: { stroke: "rgba(148,163,184,0.25)" },
            values: (_chart, ticks) => ticks.map((t) => Math.abs(t).toString()),
          },
        ],
        series: [
          {},
          {
            label: "Opened",
            stroke: "#15803d",
            fill: "rgba(22,163,74,0.35)",
            width: 1,
            points: { show: false },
            paths: uPlot.paths.bars!({ size: [0.5, 100], align: 0 }),
          },
          {
            label: "Closed",
            stroke: "#dc2626",
            fill: "rgba(220,38,38,0.3)",
            width: 1,
            points: { show: false },
            paths: uPlot.paths.bars!({ size: [0.5, 100], align: 0 }),
          },
        ],
        cursor: {
          drag: { x: false, y: false },
          focus: { prox: 32 },
        },
        hooks: {
          setCursor: [
            (u) => {
              if (!onBarHover || !onBarLeave) return;
              
              const idx = u.cursor.idx;
              if (idx == null || idx < 0 || idx >= labels.length) {
                if (lastHoverRef.current !== null) {
                  lastHoverRef.current = null;
                  onBarLeave();
                }
                return;
              }

              const quarter = labels[idx];
              const openedVal = opened[idx] ?? 0;
              const closedVal = closed[idx] ?? 0;

              let action: "open" | "close";
              
              const cursorY = u.cursor.top ?? 0;
              const anyChart = u as UplotInteractionChart;
              const zeroY = anyChart.valToPos(0, "y", true) as number;

              if (openedVal > 0 && closedVal === 0) {
                action = "open";
              } else if (closedVal < 0 && openedVal === 0) {
                action = "close";
              } else {
                action = cursorY < zeroY ? "open" : "close";
              }

              const current = lastHoverRef.current;
              if (!current || current.quarter !== quarter || current.action !== action) {
                lastHoverRef.current = { quarter, action };
                onBarHover({ quarter, action });
              }
            },
          ],
        },
      },
      [indices, opened, closed],
      containerRef.current
    );

    chartRef.current = chart;

    let rafId: number | null = null;
    if (onRenderComplete) {
      rafId = requestAnimationFrame(() => {
        onRenderComplete(Math.round(performance.now() - renderStartedAt));
      });
    }

    const anyChart = chart as UplotInteractionChart;
    const zeroY = anyChart.valToPos(0, "y", true) as number;

    const handleClick = (event: MouseEvent) => {
      if (!onBarClick || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      // Ignore clicks outside the plot area to reduce visual "flash"
      if (x < 0 || x > rect.width || y < 0 || y > rect.height) return;
      const idx = anyChart.posToIdx(x) as number;
      if (idx == null || idx < 0 || idx >= labels.length) return;

      const quarter = labels[idx];

      // Derive action primarily from underlying data at this index.
      // This is more robust than relying only on the y coordinate, which
      // can misclassify clicks and cause the drilldown table to go blank.
      const openedVal = opened[idx] ?? 0;
      const closedVal = closed[idx] ?? 0; // closed series is already negative

      let action: "open" | "close";

      if (openedVal > 0 && closedVal === 0) {
        action = "open";
      } else if (closedVal < 0 && openedVal === 0) {
        action = "close";
      } else if (openedVal === 0 && closedVal === 0) {
        // No data at this index; fall back to y position as a best effort
        action = y < zeroY ? "open" : "close";
      } else {
        // Both series have non-zero values (rare); use y position as tiebreaker
        action = y < zeroY ? "open" : "close";
      }

      onBarClick({ quarter, action });
    };

    chart.root.addEventListener("click", handleClick);

    const resizeObserver = new ResizeObserver(() => {
      if (chartRef.current && containerRef.current) {
        const nextWidth = containerRef.current.clientWidth;
        chartRef.current.setSize({ width: nextWidth, height: 400 });
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      if (rafId != null) {
        cancelAnimationFrame(rafId);
      }
      resizeObserver.disconnect();
      chart.root.removeEventListener("click", handleClick);
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [data, ticker, onBarClick, onBarHover, onBarLeave, onRenderComplete]);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Investor Activity for {ticker} (uPlot)</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>Investor Activity for {ticker} (uPlot)</span>
          {latencyBadge}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={containerRef} className="h-[400px] w-full" />
      </CardContent>
    </Card>
  );
});
