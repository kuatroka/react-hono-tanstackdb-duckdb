"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent, LegendComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import uPlot from "uplot";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { type InvestorFlow } from "@/types";

// Register only the modules this chart needs for tree shaking

echarts.use([
    LineChart,
    GridComponent,
    TooltipComponent,
    LegendComponent,
    CanvasRenderer,
]);

interface InvestorFlowChartProps {
    data: readonly InvestorFlow[];
    ticker: string;
    latencyBadge?: React.ReactNode;
    /** Callback when chart render completes with render time in ms */
    onRenderComplete?: (renderMs: number) => void;
}

interface InvestorFlowTooltipParam {
    axisValueLabel?: string;
    seriesName?: string;
    value?: number | string | null;
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
                <CardTitle className="flex items-center justify-between gap-2">
                    <span>{title}</span>
                    {latencyBadge}
                </CardTitle>
            </CardHeader>
            <CardContent className="h-[450px] min-w-0">{children}</CardContent>
        </Card>
    );
}

function EmptyInvestorFlowCard({ ticker, title }: { ticker: string; title: string }) {
    return (
        <Card className="min-w-0">
            <CardHeader>
                <CardTitle>{title} for {ticker}</CardTitle>
            </CardHeader>
        </Card>
    );
}

export const InvestorFlowChart = memo(function InvestorFlowChart({ data, ticker, latencyBadge, onRenderComplete }: InvestorFlowChartProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const chartRef = useRef<echarts.EChartsType | null>(null);
    const renderStartRef = useRef<number | null>(null);
    const prevDataSignatureRef = useRef<string>("");

    const chartData = useMemo(
        () => data.map((item) => ({
            quarter: item.quarter,
            inflow: item.inflow,
            outflow: item.outflow,
        })),
        [data],
    );

    const option = useMemo<echarts.EChartsCoreOption | null>(() => {
        if (chartData.length === 0) return null;

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
                formatter: (params: InvestorFlowTooltipParam[] | InvestorFlowTooltipParam) => {
                    const rows = Array.isArray(params) ? params : [params];
                    const lines = rows.map((row) => {
                        const value = Number(row.value ?? 0);
                        return `${row.seriesName}: ${value.toLocaleString()}`;
                    });
                    return [`<strong>${rows[0]?.axisValueLabel ?? ""}</strong>`, ...lines].join("<br/>");
                },
            },
            legend: {
                top: 8,
                right: 0,
            },
            xAxis: {
                type: "category",
                data: chartData.map((item) => item.quarter),
                boundaryGap: false,
                axisLabel: {
                    hideOverlap: true,
                    formatter: (value: string) => {
                        const match = value.match(/^(\d{4})-Q(\d)$/);
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
                splitLine: {
                    lineStyle: {
                        type: "dashed",
                        color: "rgba(148,163,184,0.3)",
                    },
                },
            },
            series: [
                {
                    name: "Inflow",
                    type: "line",
                    smooth: true,
                    showSymbol: false,
                    symbol: "circle",
                    lineStyle: {
                        width: 3,
                        color: "hsl(142, 76%, 36%)",
                    },
                    itemStyle: {
                        color: "hsl(142, 76%, 36%)",
                    },
                    emphasis: {
                        focus: "series",
                        scale: true,
                    },
                    data: chartData.map((item) => item.inflow),
                },
                {
                    name: "Outflow",
                    type: "line",
                    smooth: true,
                    showSymbol: false,
                    symbol: "circle",
                    lineStyle: {
                        width: 3,
                        color: "hsl(0, 84%, 60%)",
                    },
                    itemStyle: {
                        color: "hsl(0, 84%, 60%)",
                    },
                    emphasis: {
                        focus: "series",
                        scale: true,
                    },
                    data: chartData.map((item) => item.outflow),
                },
            ],
        };
    }, [chartData]);

    useEffect(() => {
        const nextSignature = JSON.stringify(chartData.map((item) => [item.quarter, item.inflow, item.outflow]));
        if (chartData.length > 0 && nextSignature !== prevDataSignatureRef.current) {
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
        return <EmptyInvestorFlowCard ticker={ticker} title="Investor Flow (ECharts)" />;
    }

    return (
        <InvestorFlowCard
            title={`Investor Flow for ${ticker} (ECharts)`}
            latencyBadge={latencyBadge}
        >
            <div ref={containerRef} className="h-full w-full min-w-0" />
        </InvestorFlowCard>
    );
});

export const InvestorFlowUplotChart = memo(function InvestorFlowUplotChart({ data, ticker, latencyBadge, onRenderComplete }: InvestorFlowChartProps) {
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
                        values: (_chart, ticks) => ticks.map((tick) => {
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
                chartRef.current.setSize({ width: containerRef.current.clientWidth, height: 400 });
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
        return <EmptyInvestorFlowCard ticker={ticker} title="Investor Flow (uPlot)" />;
    }

    return (
        <InvestorFlowCard
            title={`Investor Flow for ${ticker} (uPlot)`}
            latencyBadge={latencyBadge}
        >
            <div ref={containerRef} className="h-full w-full min-w-0" />
        </InvestorFlowCard>
    );
});
