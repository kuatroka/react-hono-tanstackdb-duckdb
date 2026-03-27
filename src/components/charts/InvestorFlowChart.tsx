
"use client";

import { useEffect, useRef, useState } from "react";
import {
    Line,
    LineChart,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
} from "recharts";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { type InvestorFlow } from "@/types";

interface InvestorFlowChartProps {
    data: readonly InvestorFlow[];
    ticker: string;
    latencyBadge?: React.ReactNode;
}

export function InvestorFlowChart({ data, ticker, latencyBadge }: InvestorFlowChartProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [chartSize, setChartSize] = useState<{ width: number; height: number } | null>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const updateSize = () => {
            const width = container.clientWidth;
            const height = container.clientHeight;

            if (width > 0 && height > 0) {
                setChartSize((current) => {
                    if (current?.width === width && current?.height === height) {
                        return current;
                    }
                    return { width, height };
                });
            }
        };

        updateSize();

        const observer = new ResizeObserver(() => {
            updateSize();
        });

        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    if (data.length === 0) {
        return (
            <Card className="min-w-0">
                <CardHeader>
                    <CardTitle>Investor Flow for {ticker}</CardTitle>
                    <CardDescription>No flow data available</CardDescription>
                </CardHeader>
            </Card>
        );
    }

    return (
        <Card className="min-w-0">
            <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                    <span>Investor Flow for {ticker}</span>
                    {latencyBadge}
                </CardTitle>
                <CardDescription>
                    Inflow and Outflow per quarter
                </CardDescription>
            </CardHeader>
            <CardContent className="min-w-0">
                <div ref={containerRef} className="h-[400px] w-full min-w-0">
                    {chartSize ? (
                        <LineChart
                            width={chartSize.width}
                            height={chartSize.height}
                            data={[...data]}
                            margin={{
                                top: 5,
                                right: 30,
                                left: 20,
                                bottom: 5,
                            }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.25)" />
                            <XAxis
                                dataKey="quarter"
                                tick={{ fill: "#6b7280", fontSize: 12 }}
                                tickLine={{ stroke: "#6b7280" }}
                                axisLine={{ stroke: "#6b7280" }}
                            />
                            <YAxis
                                tick={{ fill: "#6b7280", fontSize: 12 }}
                                tickLine={{ stroke: "#6b7280" }}
                                axisLine={{ stroke: "#6b7280" }}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: "hsl(var(--card))",
                                    borderColor: "hsl(var(--border))",
                                    borderRadius: "var(--radius)",
                                    color: "hsl(var(--foreground))"
                                }}
                            />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey="inflow"
                                name="Inflow"
                                stroke="#15803d" // Green similar to 'opened'
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 6 }}
                            />
                            <Line
                                type="monotone"
                                dataKey="outflow"
                                name="Outflow"
                                stroke="#dc2626" // Red similar to 'closed'
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 6 }}
                            />
                        </LineChart>
                    ) : null}
                </div>
            </CardContent>
        </Card>
    );
}
