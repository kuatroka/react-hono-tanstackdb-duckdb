import { memo, useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent, LegendComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { LegacyGridContainLabel } from "echarts/features";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LatencyBadge, type DataFlow } from "@/components/LatencyBadge";
import type { CikQuarterlyData } from "@/collections";
import { createDeferredRenderCompletion } from "./renderTiming";

echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer,
  LegacyGridContainLabel,
]);

interface CikValueEchartsChartProps {
  data: readonly CikQuarterlyData[];
  cikName?: string;
  dataLoadMs?: number;
  renderMs?: number;
  source?: "tsdb-api" | "tsdb-indexeddb" | "tsdb-memory" | "unknown";
  onRenderComplete?: (renderMs: number) => void;
}

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

export const CikValueEchartsChart = memo(function CikValueEchartsChart({
  data,
  cikName,
  dataLoadMs,
  renderMs,
  source = "unknown",
  onRenderComplete,
}: CikValueEchartsChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.EChartsType | null>(null);
  const renderStartRef = useRef<number | null>(null);

  const chartData = useMemo(() => {
    if (data.length === 0) return null;

    const sorted = [...data].sort((a, b) => {
      const parseQuarter = (q: string) => {
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
    return { labels, values };
  }, [data]);

  useEffect(() => {
    if (chartData && chartData.labels.length > 0) {
      renderStartRef.current = performance.now();
    } else {
      renderStartRef.current = null;
    }
  }, [chartData]);

  const option = useMemo<echarts.EChartsCoreOption | null>(() => {
    if (!chartData) return null;

    const { labels, values } = chartData;
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal;
    const padding = range > 0 ? range * 0.1 : maxVal * 0.1 || 1000;
    const yMin = Math.max(0, minVal - padding);
    const yMax = maxVal + padding;

    return {
      animation: false,
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
        formatter: (params: Array<{ axisValueLabel?: string; value?: number | string | null }>) => {
          const value = Number(params[0]?.value ?? 0);
          return [`<strong>${params[0]?.axisValueLabel ?? ""}</strong>`, formatValue(value)].join("<br/>");
        },
      },
      xAxis: {
        type: "category",
        data: labels,
        boundaryGap: false,
        axisLabel: {
          hideOverlap: true,
          formatter: (value: string) => {
            const match = value.match(/^(\d{4})[-]?Q(\d)$/);
            if (match) {
              const [, year, quarter] = match;
              return `Q${quarter} '${year.slice(-2)}`;
            }
            return value;
          },
        },
      },
      yAxis: {
        type: "value",
        min: yMin,
        max: yMax,
        splitLine: {
          lineStyle: {
            type: "dashed",
            color: "rgba(148,163,184,0.3)",
          },
        },
        axisLabel: {
          formatter: (value: number) => formatValue(value),
        },
      },
      series: [
        {
          name: "Portfolio Value",
          type: "line",
          smooth: true,
          showSymbol: false,
          lineStyle: {
            width: 2,
            color: "hsl(221, 83%, 53%)",
          },
          itemStyle: {
            color: "hsl(221, 83%, 53%)",
          },
          areaStyle: {
            color: "rgba(59,130,246,0.15)",
          },
          emphasis: {
            focus: "series",
            scale: true,
          },
          data: values,
        },
      ],
    };
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
    const renderCompletion = createDeferredRenderCompletion({
      renderStartRef,
      onRenderComplete,
    });

    const handleFinished = () => {
      renderCompletion.schedule();
    };

    chart.off("finished", handleFinished);
    chart.on("finished", handleFinished);
    chart.resize({ width, height });
    chart.setOption(option, {
      notMerge: true,
      lazyUpdate: true,
    });
    handleFinished();

    return () => {
      renderCompletion.cancel();
      chart.off("finished", handleFinished);
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

  if (!chartData || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Value Over Time (ECharts)</CardTitle>
          <CardDescription>No quarterly data available</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const latestValue = chartData.values[chartData.values.length - 1];
  const earliestValue = chartData.values[0];
  const totalChange = earliestValue > 0 ? ((latestValue - earliestValue) / earliestValue) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>Portfolio Value Over Time (ECharts){cikName ? ` - ${cikName}` : ""}</span>
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
        <div ref={containerRef} className="h-[300px] w-full" />
      </CardContent>
    </Card>
  );
});
