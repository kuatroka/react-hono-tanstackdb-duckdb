"use client";

import { ResponsiveBar } from "@nivo/bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CusipQuarterInvestorActivity } from "@/schema";

interface InvestorActivityNivoChartProps {
  data: readonly CusipQuarterInvestorActivity[];
  ticker: string;
}

export function InvestorActivityNivoChart({ data, ticker }: InvestorActivityNivoChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Investor Activity for {ticker} (Nivo)</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  // Transform data for Nivo
  // Nivo expects an array of objects. We can put both opened and closed in the same object.
  const chartData = data.map((item) => ({
    quarter: item.quarter ?? "Unknown",
    opened: item.numOpen ?? 0,
    closed: -(item.numClose ?? 0), // Negative for below axis
  }));

  // Determine symmetric domain so zero axis sits in the middle
  const maxValue = Math.max(
    ...chartData.map((d) => Math.max(Math.abs(d.opened), Math.abs(d.closed)))
  );
  const maxDomain = maxValue * 1.1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Investor Activity for {ticker} (Nivo)</CardTitle>
      </CardHeader>
      <CardContent className="h-[450px] w-full">
        <ResponsiveBar
          data={chartData}
          keys={["opened", "closed"]}
          indexBy="quarter"
          margin={{ top: 20, right: 30, bottom: 60, left: 40 }}
          padding={0.3}
          valueScale={{ type: "linear", min: -maxDomain, max: maxDomain }}
          indexScale={{ type: "band", round: true }}
          colors={({ id }) => {
            return id === "opened" ? "hsl(142, 76%, 36%)" : "hsl(0, 84%, 60%)";
          }}
          borderRadius={4}
          axisTop={null}
          axisRight={null}
          markers={[
            {
              axis: "y",
              value: 0,
              lineStyle: {
                stroke: "hsl(var(--foreground))",
                strokeWidth: 1,
                opacity: 0.4,
              },
            },
          ]}
          axisBottom={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: -45,
          }}
          axisLeft={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
            format: (value) => Math.abs(Number(value)).toString(), // Show absolute values
          }}
          enableLabel={false}
          labelSkipWidth={12}
          labelSkipHeight={12}
          role="application"
          ariaLabel={`Investor activity bar chart for ${ticker}`}
          tooltip={({ id, value }) => (
            <div
              style={{
                padding: 12,
                color: "#fff",
                background: "#222222",
                borderRadius: 4,
              }}
            >
              <strong>
                {id === "opened" ? "Opened" : "Closed"}: {Math.abs(Number(value))} investors
              </strong>
            </div>
          )}
          theme={{
            axis: {
              ticks: {
                text: {
                  fontSize: 12,
                  fill: "hsl(var(--foreground))",
                },
              },
            },
            grid: {
              line: {
                stroke: "hsl(var(--border))",
                strokeDasharray: "4 4",
              },
            },
            tooltip: {
              container: {
                background: "hsl(var(--popover))",
                color: "hsl(var(--popover-foreground))",
                fontSize: 12,
                borderRadius: "var(--radius)",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                border: "1px solid hsl(var(--border))",
              },
            },
          }}
        />
      </CardContent>
    </Card>
  );
}
